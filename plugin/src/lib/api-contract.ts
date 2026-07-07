// 与 backend/src/lib/types.ts 保持契约一致 · 手工同步 · 未来抽 shared 包
// 契约来源:~/Code/design-review-agent/docs/api-contract.md v0.3

export type Severity = 'P0' | 'P1' | 'P2';

export interface Finding {
  severity: Severity;
  description: string;
  suggestion: string;
  principle?: string;
  category?: string;
  nodeIds?: string[];
}

export type Mode = 'light' | 'deep';

export const DIMENSION_IDS = [
  'page-layout',
  'information-grouping',
  'visual-hierarchy',
  'color',
  'contrast',
  'i18n',
  'copy',
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  'page-layout': '页面布局',
  'information-grouping': '信息分组',
  'visual-hierarchy': '视觉层级',
  color: '配色',
  contrast: '对比度',
  i18n: '多语言',
  copy: '文案',
};

// M2.5 · CoT stage
export type StageId = 'context' | 'analyzing' | 'synthesizing';

export const STAGE_LABELS: Record<StageId, string> = {
  context: '分析上下文',
  analyzing: '分析设计',
  synthesizing: '综合评审',
};

export const STAGE_SUB_TASKS: Record<StageId, string[]> = {
  context: ['打包设计稿', '提取节点结构', '理解产品语境'],
  analyzing: ['建立视觉层级模型', '评估主次对比强度', '检查间距节奏', '定位强调元素'],
  synthesizing: ['交叉引用设计原则', '分级严重度', '关联对应节点'],
};

export const STAGE_ORDER: StageId[] = ['context', 'analyzing', 'synthesizing'];

export interface FrameStructureNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  bbox: [number, number, number, number];
}

export interface ReviewRequest {
  imageBase64: string;
  dimensions: DimensionId[];
  mode: Mode;
  sessionId?: string;
  message?: string;
  frameStructure?: FrameStructureNode[];
}

// M2.5.1 · 历史记录条目 · 存 Figma clientStorage
export interface HistoryEntry {
  id: string;
  frameName: string;
  frameWidth: number;
  frameHeight: number;
  frameThumbnail?: string;
  mode: Mode;
  dimensionId: DimensionId;
  findings: Finding[];
  frameStructure?: FrameStructureNode[];
  timestamp: number; // ms epoch
  elapsedSec: number;
}

export const HISTORY_STORAGE_KEY = 'review_history_v1';
export const HISTORY_MAX_ENTRIES = 20;

export type SSEEvent =
  | { type: 'dimension_started'; dimension: string }
  | { type: 'stage_progress'; dimension: string; stage: StageId }
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
