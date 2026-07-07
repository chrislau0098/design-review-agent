import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn 一致标签 · 同结构 · 只文字色 / 边框色差异
// leading-normal + py-1 让高度更舒适(之前 py-0.5 leading-none 太窄)
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-1 text-[11.5px] font-medium tracking-tight leading-normal transition-colors duration-150 ease-out-quart',
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
