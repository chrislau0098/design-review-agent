import { z } from 'zod';
import { VercelAISDKProvider } from '@/lib/vercel-ai-sdk-provider';
import { isValidDimension } from '@/lib/dimensions';
import { ApiError, jsonErrorResponse } from '@/lib/errors';
import { encodeSSE, SSE_HEADERS, CORS_HEADERS } from '@/lib/sse';
import type { Finding } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_IMAGE_BASE64_LENGTH = 4_500_000;

const requestSchema = z.object({
  imageBase64: z.string(),
  dimensions: z.array(z.string()).min(1),
  mode: z.enum(['light', 'deep']),
  sessionId: z.string().optional(),
  message: z.string().optional(),
});

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErrorResponse(new ApiError('unsupported_image', 'Request body is not valid JSON'));
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErrorResponse(
      new ApiError('invalid_dimensions', `Invalid request body: ${parsed.error.message}`)
    );
  }

  const { imageBase64, dimensions, mode } = parsed.data;

  // Validate dimensions enum before anything else.
  if (dimensions.length === 0 || !dimensions.every(isValidDimension)) {
    return jsonErrorResponse(
      new ApiError(
        'invalid_dimensions',
        `dimensions must be non-empty and contain only valid dimension ids, got: ${JSON.stringify(dimensions)}`
      )
    );
  }

  // Image size hard gate (server-side door per api-contract.md).
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonErrorResponse(
      new ApiError(
        'image_too_large',
        `imageBase64.length (${imageBase64.length}) exceeds ${MAX_IMAGE_BASE64_LENGTH}`
      )
    );
  }

  // Basic PNG sanity check (base64 decode + magic bytes) → unsupported_image on failure.
  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    if (buffer.length === 0) {
      return jsonErrorResponse(new ApiError('unsupported_image', 'Decoded image buffer is empty'));
    }
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    if (!buffer.subarray(0, 4).equals(pngMagic)) {
      return jsonErrorResponse(
        new ApiError('unsupported_image', 'Image is not a valid PNG (magic bytes mismatch)')
      );
    }
  } catch {
    return jsonErrorResponse(new ApiError('unsupported_image', 'Failed to decode base64 image'));
  }

  if (!process.env.ARK_API_KEY) {
    return jsonErrorResponse(
      new ApiError('auth_misconfigured', 'ARK_API_KEY is not configured on the server')
    );
  }

  // M1 simplification: only the first dimension is processed, single-dimension serial.
  const dimension = dimensions[0]!;
  const provider = new VercelAISDKProvider();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let totalFindings = 0;
      let failed = false;

      try {
        for await (const event of provider.reviewDimension(imageBase64, dimension, mode)) {
          controller.enqueue(encodeSSE(event));
          if (event.type === 'finding_delta') totalFindings += 1;
          if (event.type === 'error' && !event.retryable) failed = true;
        }
      } catch (err) {
        failed = true;
        controller.enqueue(
          encodeSSE({
            type: 'error',
            code: 'model_schema_error',
            message: err instanceof Error ? err.message : 'Unknown streaming error',
            dimension,
            retryable: false,
          })
        );
      }

      const sessionId = crypto.randomUUID();
      controller.enqueue(
        encodeSSE({
          type: 'done',
          sessionId,
          summary: {
            completedDimensions: failed ? [] : [dimension],
            failedDimensions: failed ? [dimension] : [],
            totalFindings,
          },
        })
      );
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// Re-exported for potential unit testing of markdown fallback parsing shape.
export type { Finding };
