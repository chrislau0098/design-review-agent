export type ErrorCode =
  | 'invalid_dimensions'
  | 'image_too_large'
  | 'unsupported_image'
  | 'model_schema_error'
  | 'model_timeout'
  | 'partial_failure'
  | 'auth_misconfigured'
  | 'upstream_rate_limited';

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_dimensions: 400,
  image_too_large: 413,
  unsupported_image: 400,
  model_schema_error: 502,
  model_timeout: 504,
  partial_failure: 200,
  auth_misconfigured: 500,
  upstream_rate_limited: 429,
};

export const ERROR_RETRYABLE: Record<ErrorCode, boolean> = {
  invalid_dimensions: false,
  image_too_large: false,
  unsupported_image: false,
  model_schema_error: true,
  model_timeout: true,
  partial_failure: false,
  auth_misconfigured: false,
  upstream_rate_limited: true,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly dimension?: string;

  constructor(code: ErrorCode, message: string, dimension?: string) {
    super(message);
    this.code = code;
    this.dimension = dimension;
  }

  get status(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  get retryable(): boolean {
    return ERROR_RETRYABLE[this.code];
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      dimension: this.dimension,
      retryable: this.retryable,
    };
  }
}

export function jsonErrorResponse(error: ApiError): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      code: error.code,
      message: error.message,
      dimension: error.dimension,
      retryable: error.retryable,
    }),
    {
      status: error.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
