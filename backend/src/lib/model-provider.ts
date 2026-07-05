import type { Finding, Mode } from './types';

export type FindingEvent =
  | { type: 'dimension_started'; dimension: string }
  | { type: 'finding_delta'; dimension: string; finding: Finding }
  | { type: 'dimension_done'; dimension: string; findingCount: number }
  | {
      type: 'error';
      code: string;
      message: string;
      dimension?: string;
      retryable: boolean;
    };

export interface ModelProvider {
  reviewDimension(
    imageBase64: string,
    dimension: string,
    mode: Mode
  ): AsyncIterable<FindingEvent>;
}
