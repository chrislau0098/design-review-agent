import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
  animated?: boolean; // in-progress 时 shimmer
}

// 4px · foreground/85 · 250ms ease-out-quart transition
// animated=true 时 filled 内加 shimmer 覆盖动画 · 与 asymptote 曲线双保险(即使 progress 停下也有视觉动感)
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, animated = false, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn('relative h-1 w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
      >
        <div
          className="h-full bg-progress transition-all duration-[250ms] ease-out-quart relative overflow-hidden"
          style={{ width: `${clamped}%` }}
        >
          {animated && (
            <div
              className="absolute inset-0 animate-progress-shimmer pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.35) 50%, transparent 100%)',
                width: '30%',
              }}
            />
          )}
        </div>
      </div>
    );
  }
);
Progress.displayName = 'Progress';
