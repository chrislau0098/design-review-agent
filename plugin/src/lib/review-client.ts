import type { ReviewRequest, SSEEvent } from './api-contract';

export const BACKEND_URL = 'https://design-review-agent.vercel.app/api/review';

export interface ReviewCallbacks {
  onEvent: (event: SSEEvent) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

// SSE 消费 · 按 api-contract §Response Merge 规则处理
// M2 backend 端 findings 会批量到达(non-streaming) · 我们的 parser 一样按事件流处理
export async function runReview(request: ReviewRequest, cb: ReviewCallbacks): Promise<void> {
  let response: Response;
  try {
    response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (e) {
    cb.onError(`网络错误:${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      detail += ` · ${body.slice(0, 200)}`;
    } catch {
      // ignore
    }
    cb.onError(detail);
    return;
  }

  if (!response.body) {
    cb.onError('响应体为空 · 无 stream 可读');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 切 SSE event
      while (true) {
        const idx = buffer.indexOf('\n\n');
        if (idx === -1) break;
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as SSEEvent;
            cb.onEvent(parsed);
          } catch (e) {
            // 单个坏事件不阻塞后续 stream
            console.warn('SSE parse failed:', e, payload);
          }
        }
      }
    }
  } catch (e) {
    cb.onError(`Stream 读取中断:${e instanceof Error ? e.message : String(e)}`);
    return;
  } finally {
    cb.onDone();
  }
}
