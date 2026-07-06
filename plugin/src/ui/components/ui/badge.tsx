import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// impeccable · subtle severity indicators
// 不用饱和填充 · 用 dot + text 或 outline · 保持对比但降低视觉重量
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors duration-150 ease-out-quart',
  {
    variants: {
      variant: {
        default: 'bg-primary/8 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-muted-foreground',
        // Severity · dot before label · 无强填充 · impeccable 灵魂
        p0: 'text-severity-p0 bg-severity-p0/8',
        p1: 'text-severity-p1 bg-severity-p1/10',
        p2: 'text-muted-foreground bg-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean; // 前置一个小圆点(视觉锚点 · 不做主要色区)
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'p0' && 'bg-severity-p0',
            variant === 'p1' && 'bg-severity-p1',
            variant === 'p2' && 'bg-muted-foreground/60',
            !variant && 'bg-primary/60'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { badgeVariants };
