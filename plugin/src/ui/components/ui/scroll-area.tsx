import * as React from 'react';
import { cn } from '@/lib/utils';

// 简化版 · 不用 Radix ScrollArea(Radix 依赖 ResizeObserver + Portal · Figma iframe 有兼容代价)
// Figma UI 里原生滚动样式已经够用 · 只加个 thin scrollbar
export const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-y-auto overflow-x-hidden', className)}
      style={{ scrollbarWidth: 'thin' }}
      {...props}
    >
      {children}
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';
