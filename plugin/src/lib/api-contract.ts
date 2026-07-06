// 与 backend/src/lib/types.ts 保持契约一致 · 手工同步 · 未来抽 shared 包
// 契约来源:~/Code/design-review-agent/docs/api-contract.md v0.2

export type Severity = 'P0' | 'P1' | 'P2';

export interface Finding {
  severity: Severity;
  description: string;
  suggestion: string;
}

export type Mode = 'light' | 'deep';

export const DIMENSION_IDS = [
  'information-grouping',
  'visual-hierarchy',
  'color',
  'contrast',
  'i18n',
  'copy',
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  'information-grouping': '信息分组',
  'visual-hierarchy': '视觉层级',
  color: '配色',
  contrast: '对比度',
  i18n: '多语言',
  copy: '文案',
};

export interface ReviewRequest {
  imageBase64: string;
  dimensions: DimensionId[];
  mode: Mode;
  sessionId?: string;
  message?: string;
}

export type SSEEvent =
  | { type: 'dimension_started'; dimension: string }
  | { type: 'finding_delta'; dimension: string; finding: Finding }
  | { type: 'dimension_done'; dimension: string; findingCount: number }
  | {
      type: 'error';
      code: string;
      message: string;
      dimension?: string;
      retryable: boolean;
    }
  | {
      type: 'done';
      sessionId: string;
      summary: {
        completedDimensions: string[];
        failedDimensions: string[];
        totalFindings: number;
      };
    };
