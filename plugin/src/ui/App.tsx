import { useEffect, useState } from 'react';
import { Button } from '@/ui/components/ui/button';
import { Separator } from '@/ui/components/ui/separator';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { FrameCard } from '@/ui/components/FrameCard';
import { CoTCard } from '@/ui/components/CoTCard';
import { FindingsList } from '@/ui/components/FindingsList';
import { runReview } from '@/lib/review-client';
import { DIMENSION_LABELS, type DimensionId, type Finding, type Mode } from '@/lib/api-contract';
import { AlertCircle, MousePointerClick, Sparkles, Zap } from 'lucide-react';

// Figma sandbox 传给 UI 的消息类型
type FigmaMessage =
  | { type: 'FRAME_SELECTED'; frameName: string; width: number; height: number; thumbnailUrl?: string }
  | { type: 'NO_SELECTION' }
  | { type: 'FRAME_EXPORTED'; imageBase64: string }
  | { type: 'EXPORT_FAILED'; message: string };

// UI 传给 Figma sandbox 的消息类型
type UIMessage = { type: 'REQUEST_EXPORT' } | { type: 'CLOSE' };

function postToFigma(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

type AppState =
  | { phase: 'no-selection' }
  | { phase: 'selected'; frame: { name: string; width: number; height: number; thumbnail?: string } }
  | {
      phase: 'reviewing';
      frame: { name: string; width: number; height: number; thumbnail?: string };
      step: 'sending' | 'thinking' | 'generating';
      findings: Finding[];
    }
  | {
      phase: 'done';
      frame: { name: string; width: number; height: number; thumbnail?: string };
      findings: Finding[];
    }
  | { phase: 'error'; message: string; frame?: { name: string; width: number; height: number; thumbnail?: string } };

// M2 只 wire visual-hierarchy · M3a 加维度多选
const M2_DIMENSION: DimensionId = 'visual-hierarchy';

export function App() {
  const [state, setState] = useState<AppState>({ phase: 'no-selection' });
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as FigmaMessage | undefined;
      if (!msg) return;

      if (msg.type === 'NO_SELECTION') {
        setState({ phase: 'no-selection' });
      } else if (msg.type === 'FRAME_SELECTED') {
        setState((prev) => {
          // 评审中不覆盖状态
          if (prev.phase === 'reviewing') return prev;
          return {
            phase: 'selected',
            frame: {
              name: msg.frameName,
              width: msg.width,
              height: msg.height,
              thumbnail: msg.thumbnailUrl,
            },
          };
        });
      } else if (msg.type === 'FRAME_EXPORTED') {
        // 拿到 base64 · 触发 backend 调用
        setState((prev) => {
          if (prev.phase !== 'reviewing') return prev;
          return { ...prev, step: 'thinking' };
        });
        void kickoffReview(msg.imageBase64);
      } else if (msg.type === 'EXPORT_FAILED') {
        setState({
          phase: 'error',
          message: `导出失败:${msg.message}`,
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mode]);

  const kickoffReview = async (imageBase64: string) => {
    // 图片大小 client-side 硬门 · api-contract §图片大小上限
    if (imageBase64.length > 4_500_000) {
      setState((prev) => ({
        phase: 'error',
        message: `导出图片太大(${(imageBase64.length / 1_000_000).toFixed(1)}MB)· 请缩小 Frame 或降低 scale`,
        frame: prev.phase === 'reviewing' ? prev.frame : undefined,
      }));
      return;
    }

    const collected: Finding[] = [];
    await runReview(
      {
        imageBase64,
        dimensions: [M2_DIMENSION],
        mode,
      },
      {
        onEvent: (event) => {
          if (event.type === 'finding_delta') {
            collected.push(event.finding);
            setState((prev) => {
              if (prev.phase !== 'reviewing') return prev;
              return { ...prev, step: 'generating', findings: [...prev.findings, event.finding] };
            });
          } else if (event.type === 'dimension_started') {
            setState((prev) => {
              if (prev.phase !== 'reviewing') return prev;
              return { ...prev, step: 'thinking' };
            });
          } else if (event.type === 'error') {
            setState((prev) => ({
              phase: 'error',
              message: `${event.code} · ${event.message}`,
              frame: prev.phase === 'reviewing' ? prev.frame : undefined,
            }));
          } else if (event.type === 'done') {
            setState((prev) => {
              if (prev.phase !== 'reviewing') return prev;
              return { phase: 'done', frame: prev.frame, findings: collected };
            });
          }
        },
        onError: (message) => {
          setState((prev) => ({
            phase: 'error',
            message,
            frame: prev.phase === 'reviewing' ? prev.frame : undefined,
          }));
        },
        onDone: () => {
          // stream 结束(fetch 关闭)· 如果没走 done 分支就 fallback 到 done state
          setState((prev) => {
            if (prev.phase !== 'reviewing') return prev;
            return { phase: 'done', frame: prev.frame, findings: prev.findings };
          });
        },
      }
    );
  };

  const handleStartReview = () => {
    if (state.phase !== 'selected') return;
    setState({
      phase: 'reviewing',
      frame: state.frame,
      step: 'sending',
      findings: [],
    });
    postToFigma({ type: 'REQUEST_EXPORT' });
  };

  const handleReset = () => {
    setState((prev) => {
      if ('frame' in prev && prev.frame) {
        return { phase: 'selected', frame: prev.frame };
      }
      return { phase: 'no-selection' };
    });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 pb-2 flex items-center gap-2 border-b">
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold flex-1">Base 设计评审 Agent</div>
        <div className="text-[10px] text-muted-foreground">M2 · visual-hierarchy</div>
      </header>

      <ScrollArea className="flex-1 p-3 space-y-3">
        {state.phase === 'no-selection' && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MousePointerClick className="w-6 h-6 text-muted-foreground" />
            <div className="text-xs text-muted-foreground max-w-[200px]">
              在 Figma 里选中一个 Frame 或 Component,开始 AI 视觉层级评审
            </div>
          </div>
        )}

        {(state.phase === 'selected' ||
          state.phase === 'reviewing' ||
          state.phase === 'done') && (
          <>
            <FrameCard
              frameName={state.frame.name}
              frameSize={{ width: state.frame.width, height: state.frame.height }}
              thumbnailUrl={state.frame.thumbnail}
            />

            {state.phase === 'selected' && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-0.5 pt-1">
                  评审深度
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={mode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode('light')}
                  >
                    <Zap className="w-3 h-3" /> 轻量 (Turbo)
                  </Button>
                  <Button
                    variant={mode === 'deep' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode('deep')}
                  >
                    <Sparkles className="w-3 h-3" /> 深度 (Pro)
                  </Button>
                </div>
                <Button className="w-full mt-1" onClick={handleStartReview}>
                  开始评审
                </Button>
              </>
            )}

            {state.phase === 'reviewing' && (
              <>
                <CoTCard
                  dimensionLabel={DIMENSION_LABELS[M2_DIMENSION]}
                  step={state.step}
                />
                {state.findings.length > 0 && (
                  <>
                    <Separator />
                    <FindingsList
                      findings={state.findings}
                      dimensionLabel={DIMENSION_LABELS[M2_DIMENSION]}
                    />
                  </>
                )}
              </>
            )}

            {state.phase === 'done' && (
              <>
                <FindingsList
                  findings={state.findings}
                  dimensionLabel={DIMENSION_LABELS[M2_DIMENSION]}
                />
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleReset}>
                  重新评审
                </Button>
              </>
            )}
          </>
        )}

        {state.phase === 'error' && (
          <>
            {state.frame && (
              <FrameCard
                frameName={state.frame.name}
                frameSize={{ width: state.frame.width, height: state.frame.height }}
                thumbnailUrl={state.frame.thumbnail}
              />
            )}
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs text-destructive leading-relaxed">{state.message}</div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
              重试
            </Button>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
