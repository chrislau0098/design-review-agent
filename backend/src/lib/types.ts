export type Severity = 'P0' | 'P1' | 'P2';

export interface Finding {
  severity: Severity;
  description: string;
  suggestion: string;
}

export const DIMENSION_IDS = [
  'information-grouping',
  'visual-hierarchy',
  'color',
  'contrast',
  'i18n',
  'copy',
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export type Mode = 'light' | 'deep';

export interface SSERequest {
  imageBase64: string;
  dimensions: string[];
  mode: Mode;
  sessionId?: string;
  message?: string;
}
