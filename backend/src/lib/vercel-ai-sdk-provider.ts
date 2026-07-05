import type { ModelProvider, FindingEvent } from './model-provider';
import type { Finding, Mode } from './types';
import { DIMENSION_PROMPTS, isValidDimension } from './dimensions';
import { ApiError } from './errors';

const FINDING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          description: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['severity', 'description', 'suggestion'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
} as const;

function getConfig() {
  const apiKey = process.env.ARK_API_KEY;
  const baseURL = process.env.ARK_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new ApiError('auth_misconfigured', 'ARK_API_KEY or ARK_BASE_URL is not configured');
  }
  return { apiKey, baseURL };
}

function getModelId(mode: Mode): string {
  const modelId = mode === 'deep' ? process.env.ARK_MODEL_PRO : process.env.ARK_MODEL_TURBO;
  if (!modelId) {
    throw new ApiError('auth_misconfigured', `ARK model id for mode "${mode}" is not configured`);
  }
  return modelId;
}

function parseFindingsFromContent(content: string): Finding[] {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const list = Array.isArray(parsed?.findings) ? parsed.findings : [];
    const out: Finding[] = [];
    for (const item of list) {
      if (
        item &&
        (item.severity === 'P0' || item.severity === 'P1' || item.severity === 'P2') &&
        typeof item.description === 'string' &&
        typeof item.suggestion === 'string'
      ) {
        out.push({
          severity: item.severity,
          description: item.description,
          suggestion: item.suggestion,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function parseMarkdownFallback(text: string): Finding[] {
  const findings: Finding[] = [];
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const severityMatch = block.match(/P[0-2]/);
    if (!severityMatch) continue;
    findings.push({
      severity: severityMatch[0] as Finding['severity'],
      description: block.trim().slice(0, 500),
      suggestion: '(markdown fallback · 未结构化解析,详见 description)',
    });
  }
  return findings;
}

async function callArk(args: {
  apiKey: string;
  baseURL: string;
  modelId: string;
  systemPrompt: string;
  imageBase64: string;
  useJsonSchema: boolean;
}): Promise<{ content: string; usage?: unknown }> {
  const { apiKey, baseURL, modelId, systemPrompt, imageBase64, useJsonSchema } = args;
  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ],
  };
  if (useJsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'findings_response',
        strict: true,
        schema: FINDING_JSON_SCHEMA,
      },
    };
  }
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 429) {
      throw new ApiError('upstream_rate_limited', `ARK 429: ${errText.slice(0, 200)}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ApiError('auth_misconfigured', `ARK ${res.status}: ${errText.slice(0, 200)}`);
    }
    throw new ApiError(
      'model_schema_error',
      `ARK HTTP ${res.status}: ${errText.slice(0, 300)}`
    );
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  return { content, usage: payload.usage };
}

export class VercelAISDKProvider implements ModelProvider {
  async *reviewDimension(
    imageBase64: string,
    dimension: string,
    mode: Mode
  ): AsyncIterable<FindingEvent> {
    yield { type: 'dimension_started', dimension };

    if (!isValidDimension(dimension)) {
      yield {
        type: 'error',
        code: 'invalid_dimensions',
        message: `Unknown dimension: ${dimension}`,
        dimension,
        retryable: false,
      };
      return;
    }

    const systemPrompt = DIMENSION_PROMPTS[dimension];
    let findings: Finding[] = [];

    try {
      const { apiKey, baseURL } = getConfig();
      const modelId = getModelId(mode);

      const primary = await callArk({
        apiKey,
        baseURL,
        modelId,
        systemPrompt,
        imageBase64,
        useJsonSchema: true,
      });
      findings = parseFindingsFromContent(primary.content);

      if (findings.length === 0) {
        yield {
          type: 'error',
          code: 'model_schema_error',
          message: 'json_schema response returned zero parseable findings, retrying via markdown',
          dimension,
          retryable: true,
        };
        const fallback = await callArk({
          apiKey,
          baseURL,
          modelId,
          systemPrompt:
            systemPrompt +
            '\n\n以 markdown 段落输出 · 每条 finding 一段 · 段落内包含 severity(P0/P1/P2)/描述/建议',
          imageBase64,
          useJsonSchema: false,
        });
        findings = parseMarkdownFallback(fallback.content);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        yield {
          type: 'error',
          code: err.code,
          message: err.message,
          dimension,
          retryable: err.retryable,
        };
        return;
      }
      yield {
        type: 'error',
        code: 'model_schema_error',
        message: err instanceof Error ? err.message : 'Unknown model provider error',
        dimension,
        retryable: false,
      };
      return;
    }

    for (const finding of findings) {
      yield { type: 'finding_delta', dimension, finding };
    }

    yield { type: 'dimension_done', dimension, findingCount: findings.length };
  }
}
