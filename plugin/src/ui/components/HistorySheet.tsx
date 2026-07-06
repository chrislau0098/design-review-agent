import { useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import type { HistoryEntry } from '@/lib/api-contract';
import { DIMENSION_LABELS } from '@/lib/api-contract';
import { cn } from '@/lib/utils';

interface HistorySheetProps {
  open: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onSelect: (entry: HistoryEntry) => void;
}

// 从右侧滑出的 sheet · 覆盖整个 UI 高度 · 单列列表
export function HistorySheet({ open, entries, onClose, onSelect }: HistorySheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 bg-background/60 backdrop-blur-[2px] transition-opacity duration-200 ease-out-quart',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-[85%] bg-background border-l border-border shadow-[-8px_0_24px_-8px_rgb(0_0_0_/_0.08)] transition-transform duration-250 ease-out-quart flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="text-[13px] font-semibold flex-1">评审历史</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {entries.length} 条
          </div>
          <button
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors duration-150 ease-out-quart"
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <div className="text-[12px] text-muted-foreground">
              暂无历史 · 完成一次评审后自动记录
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className="w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/50 transition-colors duration-150 ease-out-quart flex gap-3 items-center"
                onClick={() => onSelect(entry)}
              >
                <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {entry.frameThumbnail && (
                    <img
                      src={entry.frameThumbnail}
                      alt={entry.frameName}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{entry.frameName}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">
                    {DIMENSION_LABELS[entry.dimensionId]} · {entry.findings.length} findings ·{' '}
                    {entry.mode === 'deep' ? 'Pro' : 'Turbo'}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground/70 tabular-nums">
                    {formatRelative(entry.timestamp)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} 天前`;
  const date = new Date(ts);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}
