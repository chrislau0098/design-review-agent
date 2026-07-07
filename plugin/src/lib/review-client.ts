import type { ReviewRequest, SSEEvent } from './api-contract';

export const BACKEND_URL = 'https://design-review-agent.vercel.app/api/review';

export interface ReviewCallbacks {
  onEvent: (event: SSEEvent) => void;
  onError: (message: string) => void;
  onDone: (reason: 'stream_ended' | 'aborted' | 'error') => void;
}

// M2.5.4 · SSE inactivity 检测 · 300s 无 event 认为 backend 超时
const INACTIVITY_TIMEOUT_MS = 300_000;

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
    cb.onDone('error');
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
    cb.onDone('error');
    return;
  }

  if (!response.body) {
    cb.onError('响应体为空 · 无 stream 可读');
    cb.onDone('error');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEventTime = Date.now();
  let sawDoneEvent = false;

  // Inactivity watchdog · 3 分钟无 event 则 abort
  const watchdogInterval = setInterval(() => {
    if (Date.now() - lastEventTime > INACTIVITY_TIMEOUT_MS) {
      cb.onError('SSE 流 3 分钟无新事件 · 可能是后端超时或网络中断');
      clearInterval(watchdogInterval);
      reader.cancel().catch(() => {});
    }
  }, 10_000);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

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
            if (parsed.type === 'done') sawDoneEvent = true;
            lastEventTime = Date.now();
            cb.onEvent(parsed);
          } catch (e) {
            console.warn('SSE parse failed:', e, payload);
          }
        }
      }
    }
  } catch (e) {
    clearInterval(watchdogInterval);
    if (!sawDoneEvent) {
      cb.onError(`Stream 读取中断:${e instanceof Error ? e.message : String(e)}`);
      cb.onDone('error');
    } else {
      cb.onDone('stream_ended');
    }
    return;
  }
  clearInterval(watchdogInterval);

  // Stream closed without done event(Vercel 300s hard cap 断连)· 向上层报超时
  if (!sawDoneEvent) {
    cb.onError('评审超时 · Vercel Hobby plan 单请求 300s 上限 · Doubao 处理复杂 Frame 可能超出');
  }
  cb.onDone('stream_ended');
}
