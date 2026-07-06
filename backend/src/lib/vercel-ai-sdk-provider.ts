import type { ModelProvider, FindingEvent, ReviewDimensionArgs } from './model-provider';
import type { Finding, FrameStructureNode, Mode } from './types';
import { DIMENSION_PROMPTS, isValidDimension } from './dimensions';
import { ApiError } from './errors';

// JSON schema for structured findings output · Doubao 2.1 Turbo/Pro 均原生支持
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
          principle: { type: 'string' },
          category: { type: 'string' },
          nodeIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['severity', 'description', 'suggestion', 'principle', 'category', 'nodeIds'],
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

function serializeFrameStructure(nodes: FrameStructureNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return '(未提供节点结构 · nodeIds 字段请返回空数组)';
  const lines = nodes.map((n) => {
    const bboxStr = `bbox=[${n.bbox.map((v) => v.toFixed(3)).join(',')}]`;
    const charsSnippet = n.characters ? ` text="${n.characters.slice(0, 40).replace(/\n/g, ' ')}"` : '';
    return `${n.id} · ${n.type} · name="${n.name}"${charsSnippet} · ${bboxStr}`;
  });
  return lines.join('\n');
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
        !item ||
        (item.severity !== 'P0' && item.severity !== 'P1' && item.severity !== 'P2') ||
        typeof item.description !== 'string' ||
        typeof item.suggestion !== 'string'
      ) {
        continue;
      }
      const finding: Finding = {
        severity: item.severity,
        description: item.description,
        suggestion: item.suggestion,
      };
      if (typeof item.principle === 'string' && item.principle.trim()) {
        finding.principle = item.principle.trim();
      }
      if (typeof item.category === 'string' && item.category.trim()) {
        finding.category = item.category.trim();
      }
      if (Array.isArray(item.nodeIds)) {
        const ids = item.nodeIds.filter((x: unknown): x is string => typeof x === 'string' && x.trim() !== '');
        if (ids.length > 0) finding.nodeIds = ids;
      }
      out.push(finding);
    }
    return out;
  } catch {
    return [];
  }
}

interface StreamResult {
  content: string;
  hitStages: { context: boolean; analyzing: boolean; synthesizing: boolean };
}

// stream=true 消费 ARK SSE · 同步返回 async generator 让上层实时 emit stage_progress
async function* streamArk(args: {
  apiKey: string;
  baseURL: string;
  modelId: string;
  systemPrompt: string;
  imageBase64: string;
  frameStructureText: string;
}): AsyncGenerator<
  | { kind: 'reasoning'; text: string }
  | { kind: 'content'; text: string }
  | { kind: 'done'; content: string }
  | { kind: 'error'; error: ApiError }
> {
  const { apiKey, baseURL, modelId, systemPrompt, imageBase64, frameStructureText } = args;

  const userText = `${systemPrompt}\n\n## 节点结构(每行一个节点 · id · type · name · text · bbox 归一化坐标 [x,y,w,h])\n${frameStructureText}\n\n以 JSON 输出 findings 数组。`;

  const body = {
    model: modelId,
    stream: true,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'findings_response',
        strict: true,
        schema: FINDING_JSON_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    yield {
      kind: 'error',
      error: new ApiError('model_schema_error', `fetch failed: ${e instanceof Error ? e.message : String(e)}`),
    };
    return;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 429) {
      yield { kind: 'error', error: new ApiError('upstream_rate_limited', `ARK 429: ${errText.slice(0, 200)}`) };
      return;
    }
    if (res.status === 401 || res.status === 403) {
      yield { kind: 'error', error: new ApiError('auth_misconfigured', `ARK ${res.status}: ${errText.slice(0, 200)}`) };
      return;
    }
    yield { kind: 'error', error: new ApiError('model_schema_error', `ARK HTTP ${res.status}: ${errText.slice(0, 300)}`) };
    return;
  }

  if (!res.body) {
    yield { kind: 'error', error: new ApiError('model_schema_error', 'ARK response has no body') };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE lines separated by \n\n
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            yield { kind: 'done', content };
            return;
          }
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string; reasoning_content?: string };
                finish_reason?: string | null;
              }>;
            };
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
              yield { kind: 'reasoning', text: delta.reasoning_content };
            }
            if (typeof delta.content === 'string' && delta.content) {
              content += delta.content;
              yield { kind: 'content', text: delta.content };
            }
          } catch (e) {
            console.warn('ARK SSE parse err:', e, payload.slice(0, 120));
          }
        }
      }
    }
    // Stream ended without [DONE] · fallback treat as done
    yield { kind: 'done', content };
  } catch (e) {
    yield {
      kind: 'error',
      error: new ApiError('model_schema_error', `ARK stream read err: ${e instanceof Error ? e.message : String(e)}`),
    };
  }
}

export class VercelAISDKProvider implements ModelProvider {
  async *reviewDimension(args: ReviewDimensionArgs): AsyncIterable<FindingEvent> {
    const { imageBase64, dimension, mode, frameStructure } = args;
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

    // Stage 1 · context 立即 emit(打包完成 + 上下文准备完成)
    yield { type: 'stage_progress', dimension, stage: 'context' };

    let content = '';
    let stageAnalyzingEmitted = false;
    let stageSynthesizingEmitted = false;
    let apiError: ApiError | null = null;

    try {
      const { apiKey, baseURL } = getConfig();
      const modelId = getModelId(mode);
      const systemPrompt = DIMENSION_PROMPTS[dimension];
      const frameStructureText = serializeFrameStructure(frameStructure);

      const stream = streamArk({ apiKey, baseURL, modelId, systemPrompt, imageBase64, frameStructureText });

      for await (const chunk of stream) {
        if (chunk.kind === 'reasoning') {
          // 首个 reasoning chunk 到达 → 切 analyzing 阶段
          if (!stageAnalyzingEmitted) {
            stageAnalyzingEmitted = true;
            yield { type: 'stage_progress', dimension, stage: 'analyzing' };
          }
        } else if (chunk.kind === 'content') {
          // 首个 content chunk 到达 → 切 synthesizing 阶段
          if (!stageSynthesizingEmitted) {
            stageSynthesizingEmitted = true;
            yield { type: 'stage_progress', dimension, stage: 'synthesizing' };
          }
        } else if (chunk.kind === 'error') {
          apiError = chunk.error;
          break;
        } else if (chunk.kind === 'done') {
          content = chunk.content;
        }
      }
    } catch (e) {
      apiError =
        e instanceof ApiError
          ? e
          : new ApiError('model_schema_error', e instanceof Error ? e.message : 'Unknown model provider error');
    }

    if (apiError) {
      yield {
        type: 'error',
        code: apiError.code,
        message: apiError.message,
        dimension,
        retryable: apiError.retryable,
      };
      return;
    }

    // 兜底:如果没走到 synthesizing 但有 content(可能 model 没走 reasoning)
    if (content && !stageSynthesizingEmitted) {
      yield { type: 'stage_progress', dimension, stage: 'synthesizing' };
    }

    let findings = parseFindingsFromContent(content);

    if (findings.length === 0 && content) {
      // markdown fallback:model 输出不符合 schema 时 · 再来一次不带 schema
      yield {
        type: 'error',
        code: 'model_schema_error',
        message: 'schema 解析失败 · 尝试 markdown fallback(下一版接)',
        dimension,
        retryable: false,
      };
      // M2.5 简化 · fallback 路径先不重跑(streaming 里重跑一次 + reasoning · 单次调用 90s+ · 会打爆 300s 上限)
    }

    for (const finding of findings) {
      yield { type: 'finding_delta', dimension, finding };
    }

    yield { type: 'dimension_done', dimension, findingCount: findings.length };
  }
}
