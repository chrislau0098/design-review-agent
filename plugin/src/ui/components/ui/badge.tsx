import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn 一致标签 · 同结构 · 只文字色 / 边框色差异
// P0/P1/P2 共享同一视觉重量:outline · 淡背景 · 有色文字
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight leading-none transition-colors duration-150 ease-out-quart',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground bg-background',
        p0: 'border-severity-p0/25 bg-severity-p0/10 text-severity-p0',
        p1: 'border-severity-p1/25 bg-severity-p1/12 text-severity-p1',
        p2: 'border-severity-p2/25 bg-severity-p2/10 text-severity-p2',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
