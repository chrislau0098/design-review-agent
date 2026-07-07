export type Severity = 'P0' | 'P1' | 'P2';

export interface Finding {
  severity: Severity;
  description: string;
  suggestion: string;
  // M2.5 additions · 均为可选 · 空/缺失时前端 hide 对应区块
  principle?: string;
  category?: string;
  nodeIds?: string[];
}

export const DIMENSION_IDS = [
  'page-layout',           // M2.5.3 · 融合视觉层级 + 信息分组
  'information-grouping',
  'visual-hierarchy',
  'color',
  'contrast',
  'i18n',
  'copy',
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export type Mode = 'light' | 'deep';

export interface FrameStructureNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  bbox: [number, number, number, number]; // [x_norm, y_norm, w_norm, h_norm] in [0,1]
}

export interface SSERequest {
  imageBase64: string;
  dimensions: string[];
  mode: Mode;
  sessionId?: string;
  message?: string;
  frameStructure?: FrameStructureNode[];
}

// M2.5 · CoT stage 名 · 前端硬编码子任务名 · backend 只 emit stage 转换
export type StageId = 'context' | 'analyzing' | 'synthesizing';
