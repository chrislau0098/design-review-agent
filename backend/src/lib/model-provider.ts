import type { Finding, Mode, FrameStructureNode, StageId } from './types';

export type FindingEvent =
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
    };

export interface ReviewDimensionArgs {
  imageBase64: string;
  dimension: string;
  mode: Mode;
  frameStructure?: FrameStructureNode[];
}

export interface ModelProvider {
  reviewDimension(args: ReviewDimensionArgs): AsyncIterable<FindingEvent>;
}
