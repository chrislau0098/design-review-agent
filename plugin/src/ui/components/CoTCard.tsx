import { useMemo } from 'react';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Progress } from '@/ui/components/ui/progress';
import { STAGE_LABELS, STAGE_ORDER, STAGE_SUB_TASKS, type StageId } from '@/lib/api-contract';
import { Check, ChevronDown, ChevronRight, Loader2, Sparkles, Brain, Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoTCardProps {
  currentStage: StageId | null;
  stageStartTimes: Partial<Record<StageId, number>>;
  now: number;
  totalElapsedSec: number;
}

const STAGE_ICONS: Record<StageId, typeof Brain> = {
  context: Brain,
  analyzing: Search,
  synthesizing: Zap,
};

// 参考 onBeacon 三段式 · 每段可折叠 · 完成折叠 + 打勾 · 进行中展开
export function CoTCard({ currentStage, stageStartTimes, now, totalElapsedSec }: CoTCardProps) {
  const currentIdx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
  const progressPct = useMemo(() => {
    if (currentIdx < 0) return 0;
    // 3 段等分 · 每段内部再按经验时长插值
    const base = (currentIdx / STAGE_ORDER.length) * 100;
    const stageStart = stageStartTimes[currentStage!];
    if (!stageStart) return base;
    const inStageSec = (now - stageStart) / 1000;
    const stageEst: Record<StageId, number> = {
      context: 6,
      analyzing: 130,
      synthesizing: 20,
    };
    const est = stageEst[currentStage!];
    const inStageFrac = Math.min(1, inStageSec / est);
    return base + (inStageFrac * 100) / STAGE_ORDER.length;
  }, [currentIdx, currentStage, stageStartTimes, now]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">Reviewing your design</div>
          </div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
            {formatElapsed(totalElapsedSec)} · up to 3 min
          </div>
        </div>

        <Progress value={progressPct} />

        <div className="space-y-2 pt-1">
          {STAGE_ORDER.map((stage, idx) => {
            const status: 'done' | 'active' | 'pending' =
              idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending';
            const Icon = STAGE_ICONS[stage];
            const startTime = stageStartTimes[stage];
            const nextStartTime = idx < STAGE_ORDER.length - 1 ? stageStartTimes[STAGE_ORDER[idx + 1]!] : undefined;
            const elapsedSec = startTime
              ? Math.round(((nextStartTime ?? now) - startTime) / 1000)
              : 0;
            const expanded = status === 'active';

            return (
              <div
                key={stage}
                className={cn(
                  'rounded-md border border-transparent',
                  status === 'active' && 'border-border bg-muted/40'
                )}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                      status === 'done' && 'bg-primary text-primary-foreground',
                      status === 'active' && 'bg-primary/10 text-primary',
                      status === 'pending' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {status === 'done' ? (
                      <Check className="w-3 h-3" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-medium flex-1',
                      status === 'pending' && 'text-muted-foreground'
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {elapsedSec > 0 ? `${elapsedSec}s` : ''}
                  </div>
                  {expanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                {expanded && (
                  <div className="pl-8 pr-3 pb-2 space-y-1">
                    {STAGE_SUB_TASKS[stage].map((task, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-muted-foreground flex items-center gap-1.5"
                      >
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        {task}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
