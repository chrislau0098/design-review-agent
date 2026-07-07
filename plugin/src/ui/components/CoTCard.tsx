import { useEffect, useMemo, useState } from 'react';
import { Progress } from '@/ui/components/ui/progress';
import { STAGE_LABELS, STAGE_ORDER, STAGE_SUB_TASKS, type StageId } from '@/lib/api-contract';
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoTCardProps {
  currentStage: StageId | null;
  stageStartTimes: Partial<Record<StageId, number>>;
  now: number;
  totalElapsedSec: number;
}

// Accordion 风格 · 用户可点击任意段展开/折叠 · 默认 active 展开
// Progress bar 4px + primary color · 显著但不喧宾夺主
export function CoTCard({ currentStage, stageStartTimes, now, totalElapsedSec }: CoTCardProps) {
  const currentIdx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
  const [openStage, setOpenStage] = useState<StageId | null>(currentStage);

  // active stage 变化 → 自动展开(用户手动切换后不干扰当前展开状态)
  useEffect(() => {
    if (currentStage) setOpenStage(currentStage);
  }, [currentStage]);

  const progressPct = useMemo(() => {
    if (currentIdx < 0) return 0;
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
    <div className="space-y-4 rounded-lg bg-card border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-foreground/70" />
          <div className="text-[13.5px] font-semibold">正在评审</div>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatElapsed(totalElapsedSec)}
        </div>
      </div>

      <Progress value={progressPct} />

      <div className="space-y-1 pt-0.5">
        {STAGE_ORDER.map((stage, idx) => {
          const status: 'done' | 'active' | 'pending' =
            idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending';
          const startTime = stageStartTimes[stage];
          const nextStartTime =
            idx < STAGE_ORDER.length - 1 ? stageStartTimes[STAGE_ORDER[idx + 1]!] : undefined;
          const elapsedSec = startTime
            ? Math.round(((nextStartTime ?? now) - startTime) / 1000)
            : 0;
          const isOpen = openStage === stage;

          return (
            <div key={stage}>
              <button
                className="w-full flex items-center gap-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150 ease-out-quart"
                onClick={() => setOpenStage(isOpen ? null : stage)}
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {status === 'done' ? (
                    <Check className="w-3 h-3 text-foreground/70" strokeWidth={2.5} />
                  ) : status === 'active' ? (
                    <Loader2 className="w-3 h-3 text-foreground/80 animate-spin" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <div
                  className={cn(
                    'text-[13px] flex-1 text-left',
                    status === 'pending' ? 'text-muted-foreground/70' : 'text-foreground',
                    status === 'active' && 'font-medium'
                  )}
                >
                  {STAGE_LABELS[stage]}
                </div>
                <div className="text-[10.5px] text-muted-foreground tabular-nums">
                  {elapsedSec > 0 ? `${elapsedSec}s` : ''}
                </div>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 text-muted-foreground/60 transition-transform duration-200 ease-out-quart',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              {isOpen && (
                <div className="pl-6 pb-2 space-y-1">
                  {STAGE_SUB_TASKS[stage].map((task, i) => (
                    <div
                      key={i}
                      className="text-[12px] text-muted-foreground leading-[1.5]"
                    >
                      {task}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
