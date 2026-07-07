import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// 全圆角 pill · 浅底 · 无 border · Chris 指定风格
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium tracking-tight leading-normal transition-colors duration-150 ease-out-quart',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-muted-foreground bg-background',
        p0: 'bg-severity-p0/15 text-severity-p0',
        p1: 'bg-severity-p1/18 text-severity-p1',
        p2: 'bg-severity-p2/15 text-severity-p2',
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
