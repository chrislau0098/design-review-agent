import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/ui/components/ui/button';
import { Separator } from '@/ui/components/ui/separator';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { FrameCard } from '@/ui/components/FrameCard';
import { CoTCard } from '@/ui/components/CoTCard';
import { FindingsList } from '@/ui/components/FindingsList';
import { runReview } from '@/lib/review-client';
import {
  DIMENSION_LABELS,
  STAGE_ORDER,
  type DimensionId,
  type Finding,
  type FrameStructureNode,
  type Mode,
  type StageId,
} from '@/lib/api-contract';
import { AlertCircle, MousePointerClick, Sparkles, Zap } from 'lucide-react';

type FigmaMessage =
  | { type: 'FRAME_SELECTED'; frameName: string; width: number; height: number; thumbnailUrl?: string }
  | { type: 'NO_SELECTION' }
  | { type: 'FRAME_EXPORTED'; imageBase64: string; frameStructure: FrameStructureNode[] }
  | { type: 'EXPORT_FAILED'; message: string }
  | {
      type: 'INSPECT_RESULT';
      matched: number;
      usedFallback: boolean;
      fellBackToFrame: boolean;
    };

type UIMessage =
  | { type: 'REQUEST_EXPORT' }
  | { type: 'INSPECT_NODES'; nodeIds: string[]; fallbackHints: string[] }
  | { type: 'CLOSE' };

function postToFigma(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

type FrameInfo = { name: string; width: number; height: number; thumbnail?: string };

type AppState =
  | { phase: 'no-selection' }
  | { phase: 'selected'; frame: FrameInfo }
  | {
      phase: 'reviewing';
      frame: FrameInfo;
      currentStage: StageId | null;
      stageStartTimes: Partial<Record<StageId, number>>;
      startedAt: number;
      findings: Finding[];
    }
  | {
      phase: 'done';
      frame: FrameInfo;
      findings: Finding[];
      elapsedSec: number;
    }
  | { phase: 'error'; message: string; frame?: FrameInfo };

const M2_DIMENSION: DimensionId = 'visual-hierarchy';

export function App() {
  const [state, setState] = useState<AppState>({ phase: 'no-selection' });
  const [mode, setMode] = useState<Mode>('light');
  const [now, setNow] = useState<number>(Date.now());
  const [inspectToast, setInspectToast] = useState<string | null>(null);

  // 计时器 · 每 500ms tick · 只有 reviewing 阶段激活
  useEffect(() => {
    if (state.phase !== 'reviewing') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state.phase]);

  // 短暂 toast
  useEffect(() => {
    if (!inspectToast) return;
    const t = setTimeout(() => setInspectToast(null), 2500);
    return () => clearTimeout(t);
  }, [inspectToast]);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as FigmaMessage | undefined;
      if (!msg) return;

      if (msg.type === 'NO_SELECTION') {
        const s = stateRef.current;
        if (s.phase === 'reviewing') return; // 评审进行中不切
        setState({ phase: 'no-selection' });
      } else if (msg.type === 'FRAME_SELECTED') {
        const s = stateRef.current;
        if (s.phase === 'reviewing') return;
        setState({
          phase: 'selected',
          frame: {
            name: msg.frameName,
            width: msg.width,
            height: msg.height,
            thumbnail: msg.thumbnailUrl,
          },
        });
      } else if (msg.type === 'FRAME_EXPORTED') {
        void kickoffReview(msg.imageBase64, msg.frameStructure);
      } else if (msg.type === 'EXPORT_FAILED') {
        setState({ phase: 'error', message: `导出失败:${msg.message}` });
      } else if (msg.type === 'INSPECT_RESULT') {
        if (msg.matched > 0 && !msg.usedFallback) {
          setInspectToast(`已定位 ${msg.matched} 个节点`);
        } else if (msg.matched > 0 && msg.usedFallback) {
          setInspectToast(`精确定位失败 · 模糊匹配到 ${msg.matched} 个节点`);
        } else if (msg.fellBackToFrame) {
          setInspectToast('未匹配到具体节点 · 已定位到 Frame');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const kickoffReview = async (imageBase64: string, frameStructure: FrameStructureNode[]) => {
    if (imageBase64.length > 4_500_000) {
      setState({
        phase: 'error',
        message: `导出图片太大(${(imageBase64.length / 1_000_000).toFixed(1)}MB)· 请缩小 Frame 或降低 scale`,
      });
      return;
    }

    // context 阶段本地立即置(打包完成)· 后端 SSE 首个 stage_progress 也会重复置(幂等)
    setState((prev) => {
      if (prev.phase !== 'reviewing') return prev;
      return {
        ...prev,
        currentStage: 'context',
        stageStartTimes: { ...prev.stageStartTimes, context: Date.now() },
      };
    });

    const collected: Finding[] = [];
    await runReview(
      {
        imageBase64,
        dimensions: [M2_DIMENSION],
        mode,
        frameStructure,
      },
      {
        onEvent: (event) => {
          if (event.type === 'stage_progress') {
            setState((prev) => {
              if (prev.phase !== 'reviewing') return prev;
              if (prev.stageStartTimes[event.stage]) return { ...prev, currentStage: event.stage };
              return {
                ...prev,
                currentStage: event.stage,
                stageStartTimes: { ...prev.stageStartTimes, [event.stage]: Date.now() },
              };
            });
          } else if (event.type === 'finding_delta') {
            collected.push(event.finding);
            setState((prev) => {
              if (prev.phase !== 'reviewing') return prev;
              return { ...prev, findings: [...prev.findings, event.finding] };
            });
          } else if (event.type === 'error') {
            setState({ phase: 'error', message: `${event.code} · ${event.message}` });
          } else if (event.type === 'done') {
            const startedAt =
              stateRef.current.phase === 'reviewing' ? stateRef.current.startedAt : Date.now();
            setState({
              phase: 'done',
              frame: stateRef.current.phase === 'reviewing' ? stateRef.current.frame : ({} as FrameInfo),
              findings: collected,
              elapsedSec: Math.round((Date.now() - startedAt) / 1000),
            });
          }
        },
        onError: (message) => {
          setState((prev) => ({
            phase: 'error',
            message,
            frame: 'frame' in prev ? prev.frame : undefined,
          }));
        },
        onDone: () => {
          // Backup close · runReview 完成时 · state 保持 done 状态即可
        },
      }
    );
  };

  const handleStartReview = () => {
    if (state.phase !== 'selected') return;
    setState({
      phase: 'reviewing',
      frame: state.frame,
      currentStage: null,
      stageStartTimes: {},
      startedAt: Date.now(),
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

  const handleInspect = (finding: Finding) => {
    const nodeIds = finding.nodeIds ?? [];
    if (nodeIds.length === 0) return;
    // Fallback hints:从 description 里抽取带引号的短文本 · 帮 fuzzy match
    const hints: string[] = [];
    const quoted = finding.description.match(/[""「『][^""」』]{2,20}[""」』]/g);
    if (quoted) {
      for (const m of quoted) hints.push(m.slice(1, -1));
    }
    postToFigma({ type: 'INSPECT_NODES', nodeIds, fallbackHints: hints });
  };

  const totalElapsedSec = useMemo(() => {
    if (state.phase !== 'reviewing') return 0;
    return Math.max(0, Math.round((now - state.startedAt) / 1000));
  }, [state, now]);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 flex items-center gap-2 border-b bg-background">
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold flex-1">Base 设计评审 Agent</div>
        <div className="text-[10px] text-muted-foreground">M2.5 · visual-hierarchy</div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {state.phase === 'no-selection' && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <MousePointerClick className="w-8 h-8 text-muted-foreground/70" />
              <div className="text-xs text-muted-foreground max-w-[240px]">
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
                    currentStage={state.currentStage}
                    stageStartTimes={state.stageStartTimes}
                    now={now}
                    totalElapsedSec={totalElapsedSec}
                  />
                  {state.findings.length > 0 && (
                    <>
                      <Separator />
                      <FindingsList
                        findings={state.findings}
                        dimensionLabel={DIMENSION_LABELS[M2_DIMENSION]}
                        onInspect={handleInspect}
                      />
                    </>
                  )}
                </>
              )}

              {state.phase === 'done' && (
                <>
                  <div className="text-[11px] text-muted-foreground px-0.5">
                    评审完成 · 用时 {formatDuration(state.elapsedSec)}
                  </div>
                  <FindingsList
                    findings={state.findings}
                    dimensionLabel={DIMENSION_LABELS[M2_DIMENSION]}
                    onInspect={handleInspect}
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
        </div>
      </ScrollArea>

      {inspectToast && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] px-3 py-1.5 rounded-md shadow-lg pointer-events-none">
          {inspectToast}
        </div>
      )}
    </div>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} 分 ${s} 秒`;
}

// STAGE_ORDER 引用是 defensive · 避免 tree-shake 剪掉但保留 stage 类型的 import
void STAGE_ORDER;
