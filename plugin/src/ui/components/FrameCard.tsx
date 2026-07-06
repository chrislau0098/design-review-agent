interface FrameCardProps {
  frameName: string;
  frameSize: { width: number; height: number };
  thumbnailUrl?: string;
}

// impeccable · 减 elevation · 无 border · 用 bg + gap 区分
export function FrameCard({ frameName, frameSize, thumbnailUrl }: FrameCardProps) {
  return (
    <div className="flex gap-3 items-center py-1">
      <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={frameName} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
            无预览
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" title={frameName}>
          {frameName}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {Math.round(frameSize.width)} × {Math.round(frameSize.height)}
        </div>
      </div>
    </div>
  );
}
