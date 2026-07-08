import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/ui/components/ui/button';
import { Badge } from '@/ui/components/ui/badge';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { FrameCard } from '@/ui/components/FrameCard';
import { CoTCard } from '@/ui/components/CoTCard';
import { FindingsList } from '@/ui/components/FindingsList';
import { HistorySheet } from '@/ui/components/HistorySheet';
import { runReview } from '@/lib/review-client';
import {
  DIMENSION_LABELS,
  HISTORY_MAX_ENTRIES,
  type DimensionId,
  type Finding,
  type FrameStructureNode,
  type HistoryEntry,
  type Mode,
  type StageId,
} from '@/lib/api-contract';
import { AlertCircle, ChevronLeft, Clock, MousePointerClick, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type FigmaMessage =
  | { type: 'FRAME_SELECTED'; frameName: string; width: number; height: number; thumbnailUrl?: string }
  | { type: 'NO_SELECTION' }
  | { type: 'FRAME_EXPORTED'; imageBase64: string; frameStructure: FrameStructureNode[] }
  | { type: 'EXPORT_FAILED'; message: string }
  | { type: 'INSPECT_RESULT'; matched: number; usedFallback: boolean; fellBackToFrame: boolean }
  | { type: 'HISTORY_LOADED'; entries: HistoryEntry[] }
  | { type: 'HISTORY_SAVED' }
  | { type: 'HISTORY_SAVE_FAILED'; message: string };

type UIMessage =
  | { type: 'REQUEST_EXPORT' }
  | { type: 'INSPECT_NODES'; nodeIds: string[]; fallbackHints: string[] }
  | { type: 'LOAD_HISTORY' }
  | { type: 'SAVE_HISTORY'; entries: HistoryEntry[] }
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
      dimensionId: DimensionId;
      frameStructure?: FrameStructureNode[];
    }
  | {
      phase: 'done';
      frame: FrameInfo;
      findings: Finding[];
      elapsedSec: number;
      dimensionId: DimensionId;
      mode: Mode;
      frameStructure?: FrameStructureNode[];
    }
  | { phase: 'error'; message: string; frame?: FrameInfo }
  | { phase: 'viewing-history'; entry: HistoryEntry };

interface ModeOption {
  id: Mode;
  title: string;
  eta: string;
  description: string;
  icon: typeof Zap;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'light',
    title: '快速',
    eta: '1–2 min',
    description: '适用于初版设计方案快速排查潜在问题',
    icon: Zap,
  },
  {
    id: 'deep',
    title: '深度',
    eta: '5–8 min',
    description: '深度分析设计方案中存在的问题,速度较慢',
    icon: Sparkles,
  },
];

interface DimensionOption {
  id: DimensionId | string;
  label: string;
  enabled: boolean;
  comingSoon?: boolean;
}

const DIMENSION_OPTIONS: DimensionOption[] = [
  { id: 'page-layout', label: '页面布局', enabled: true },
  { id: 'base-design-spec', label: 'Base 设计规范', enabled: false, comingSoon: true },
  { id: 'i18n', label: '多语言适配', enabled: false, comingSoon: true },
  { id: 'copy', label: '文案表达', enabled: false, comingSoon: true },
];

export function App() {
  const [state, setState] = useState<AppState>({ phase: 'no-selection' });
  const [mode, setMode] = useState<Mode>('light');
  const [selectedDimension, setSelectedDimension] = useState<DimensionId>('page-layout');
  const [now, setNow] = useState<number>(Date.now());
  const [inspectToast, setInspectToast] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (state.phase !== 'reviewing') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state.phase]);

  useEffect(() => {
    if (!inspectToast) return;
    const t = setTimeout(() => setInspectToast(null), 2500);
    return () => clearTimeout(t);
  }, [inspectToast]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const historyRef = useRef(history);
  historyRef.current = history;

  const persistHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    postToFigma({ type: 'SAVE_HISTORY', entries: next });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as FigmaMessage | undefined;
      if (!msg) return;

      if (msg.type === 'NO_SELECTION') {
        const s = stateRef.current;
        if (s.phase === 'reviewing' || s.phase === 'done' || s.phase === 'viewing-history') return;
        setState({ phase: 'no-selection' });
      } else if (msg.type === 'FRAME_SELECTED') {
        const s = stateRef.current;
        if (s.phase === 'reviewing' || s.phase === 'done' || s.phase === 'viewing-history') return;
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
      } else if (msg.type === 'HISTORY_LOADED') {
        setHistory(msg.entries);
      } else if (msg.type === 'HISTORY_SAVE_FAILED') {
        console.warn('history save failed:', msg.message);
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

    setState((prev) => {
      if (prev.phase !== 'reviewing') return prev;
      return {
        ...prev,
        currentStage: 'context',
        stageStartTimes: { ...prev.stageStartTimes, context: Date.now() },
        frameStructure,
      };
    });

    const collected: Finding[] = [];
    const dimensionId = stateRef.current.phase === 'reviewing' ? stateRef.current.dimensionId : selectedDimension;

    await runReview(
      {
        imageBase64,
        dimensions: [dimensionId],
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
            const prev = stateRef.current;
            if (prev.phase !== 'reviewing') return;
            const startedAt = prev.startedAt;
            const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

            const finalState: AppState = {
              phase: 'done',
              frame: prev.frame,
              findings: collected,
              elapsedSec,
              dimensionId: prev.dimensionId,
              mode,
              frameStructure: prev.frameStructure,
            };
            setState(finalState);

            const entry: HistoryEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              frameName: prev.frame.name,
              frameWidth: prev.frame.width,
              frameHeight: prev.frame.height,
              frameThumbnail: prev.frame.thumbnail,
              mode,
              dimensionId: prev.dimensionId,
              findings: collected,
              frameStructure: prev.frameStructure,
              timestamp: Date.now(),
              elapsedSec,
            };
            const nextHistory = [entry, ...historyRef.current].slice(0, HISTORY_MAX_ENTRIES);
            persistHistory(nextHistory);
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
          // Stream 结束后兜底 · 如果还在 reviewing 就说明 backend 提前断连
          // (Vercel 300s hard cap + 复杂 Component 超时的常见路径)
          setState((prev) => {
            if (prev.phase !== 'reviewing') return prev;
            return {
              phase: 'error',
              message: '评审未完成 · 连接提前中断(Vercel 300s 上限或复杂 Frame 导致)',
              frame: prev.frame,
            };
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
      currentStage: null,
      stageStartTimes: {},
      startedAt: Date.now(),
      findings: [],
      dimensionId: selectedDimension,
    });
    postToFigma({ type: 'REQUEST_EXPORT' });
  };

  const handleReset = () => {
    setState({ phase: 'no-selection' });
  };

  const handleInspect = (finding: Finding) => {
    const nodeIds = finding.nodeIds ?? [];
    if (nodeIds.length === 0) return;
    const hints: string[] = [];
    const quoted = finding.description.match(/[""「『][^""」』]{2,20}[""」』]/g);
    if (quoted) {
      for (const m of quoted) hints.push(m.slice(1, -1));
    }
    postToFigma({ type: 'INSPECT_NODES', nodeIds, fallbackHints: hints });
  };

  const handleSelectHistory = (entry: HistoryEntry) => {
    setState({ phase: 'viewing-history', entry });
    setHistoryOpen(false);
  };

  const totalElapsedSec = useMemo(() => {
    if (state.phase !== 'reviewing') return 0;
    return Math.max(0, Math.round((now - state.startedAt) / 1000));
  }, [state, now]);

  const activeDimensionLabel =
    state.phase === 'reviewing' || state.phase === 'done'
      ? DIMENSION_LABELS[state.dimensionId]
      : state.phase === 'viewing-history'
        ? DIMENSION_LABELS[state.entry.dimensionId]
        : DIMENSION_LABELS[selectedDimension];

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-background shrink-0">
        {state.phase === 'done' || state.phase === 'viewing-history' ? (
          <>
            <button
              className="inline-flex items-center justify-center w-6 h-6 -ml-1 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors duration-150 ease-out-quart"
              onClick={handleReset}
              title="返回"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[13px] font-semibold flex-1">评审结果</div>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-foreground/70" />
            <div className="text-[13px] font-semibold flex-1">Base 设计评审 Agent</div>
          </>
        )}
        <button
          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors duration-150 ease-out-quart"
          onClick={() => {
            postToFigma({ type: 'LOAD_HISTORY' });
            setHistoryOpen(true);
          }}
          title="评审历史"
        >
          <Clock className="w-3.5 h-3.5" />
          {history.length > 0 && (
            <span className="text-[10.5px] tabular-nums">{history.length}</span>
          )}
        </button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {state.phase === 'no-selection' && (
            // v0.2.9 · min-h 让 justify-center 实际生效 · UI 高 720 · 减 header + p-4 padding ≈ 620
            <div className="flex flex-col items-center justify-center gap-3 min-h-[560px] text-center">
              <MousePointerClick className="w-6 h-6 text-muted-foreground/60" strokeWidth={1.5} />
              <div className="text-[13px] text-muted-foreground max-w-[260px] leading-[1.55]">
                在 Figma 里选中一个 Frame 或 Component,开始 AI 设计评审
              </div>
            </div>
          )}

          {state.phase === 'selected' && (
            <>
              <FrameCard
                frameName={state.frame.name}
                frameSize={{ width: state.frame.width, height: state.frame.height }}
                thumbnailUrl={state.frame.thumbnail}
              />

              {/* Mode radio cards · 选中态用 border-foreground/85 + ring 阴影(无右上 dot 遮挡) */}
              <div className="space-y-2 pt-1">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground px-0.5 font-medium">
                  评审深度
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((opt) => {
                    const active = mode === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        className={cn(
                          'text-left rounded-lg border-[1.5px] p-3 transition-all duration-150 ease-out-quart',
                          active
                            ? 'border-primary bg-card'
                            : 'border-border/40 bg-card hover:border-border/70'
                        )}
                        onClick={() => setMode(opt.id)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Icon className="w-3.5 h-3.5 text-foreground/75 shrink-0" />
                            <div className="text-[13px] font-semibold">{opt.title}</div>
                          </div>
                          <div className="text-[10.5px] text-muted-foreground tabular-nums shrink-0">
                            {opt.eta}
                          </div>
                        </div>
                        <div className="text-[11.5px] text-muted-foreground leading-[1.5]">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dimension radio · 4 项 · 一个可选 + 三个 Coming Soon */}
              <div className="space-y-2 pt-1">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground px-0.5 font-medium">
                  评审维度
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DIMENSION_OPTIONS.map((opt) => {
                    const active = opt.enabled && selectedDimension === opt.id;
                    const disabled = !opt.enabled;
                    return (
                      <button
                        key={opt.id}
                        disabled={disabled}
                        className={cn(
                          'text-left rounded-lg border-[1.5px] px-3 py-2.5 transition-all duration-150 ease-out-quart',
                          active && 'border-primary bg-card',
                          !active && !disabled && 'border-border/40 bg-card hover:border-border/70',
                          disabled && 'border-border/40 bg-card cursor-not-allowed opacity-60'
                        )}
                        onClick={() => opt.enabled && setSelectedDimension(opt.id as DimensionId)}
                      >
                        <div className="text-[12.5px] font-medium">{opt.label}</div>
                        {opt.comingSoon && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 leading-normal">
                              Coming Soon
                            </Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button className="w-full mt-2" onClick={handleStartReview}>
                开始评审
              </Button>
            </>
          )}

          {state.phase === 'reviewing' && (
            <>
              <FrameCard
                frameName={state.frame.name}
                frameSize={{ width: state.frame.width, height: state.frame.height }}
                thumbnailUrl={state.frame.thumbnail}
              />
              <CoTCard
                currentStage={state.currentStage}
                stageStartTimes={state.stageStartTimes}
                now={now}
                totalElapsedSec={totalElapsedSec}
              />
              {state.findings.length > 0 && (
                <FindingsList
                  findings={state.findings}
                  dimensionLabel={activeDimensionLabel}
                  onInspect={handleInspect}
                />
              )}
            </>
          )}

          {state.phase === 'done' && (
            <>
              <FrameCard
                frameName={state.frame.name}
                frameSize={{ width: state.frame.width, height: state.frame.height }}
                thumbnailUrl={state.frame.thumbnail}
              />
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground px-1">
                评审完成 · 用时 {formatDuration(state.elapsedSec)}
              </div>
              <FindingsList
                findings={state.findings}
                dimensionLabel={activeDimensionLabel}
                onInspect={handleInspect}
              />
            </>
          )}

          {state.phase === 'viewing-history' && (
            <>
              <FrameCard
                frameName={state.entry.frameName}
                frameSize={{ width: state.entry.frameWidth, height: state.entry.frameHeight }}
                thumbnailUrl={state.entry.frameThumbnail}
              />
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground px-1">
                历史 · {new Date(state.entry.timestamp).toLocaleString('zh-CN')} ·{' '}
                {state.entry.mode === 'deep' ? '深度' : '快速'}
              </div>
              <FindingsList
                findings={state.entry.findings}
                dimensionLabel={activeDimensionLabel}
                onInspect={handleInspect}
              />
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
              <div className="rounded-lg bg-destructive/10 px-3 py-2.5 flex gap-2 items-start">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <div className="text-[12.5px] text-destructive leading-[1.55]">{state.message}</div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
                重试
              </Button>
            </>
          )}
        </div>
      </ScrollArea>

      <HistorySheet
        open={historyOpen}
        entries={history}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectHistory}
      />

      {inspectToast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] px-3 py-1.5 rounded-md shadow-lg pointer-events-none">
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
