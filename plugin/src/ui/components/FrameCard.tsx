import { Card } from '@/ui/components/ui/card';

interface FrameCardProps {
  frameName: string;
  frameSize: { width: number; height: number };
  thumbnailUrl?: string;
}

export function FrameCard({ frameName, frameSize, thumbnailUrl }: FrameCardProps) {
  return (
    <Card className="p-2 flex gap-2 items-center">
      <div className="w-14 h-14 bg-muted rounded flex-shrink-0 overflow-hidden border">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={frameName} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
            无预览
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={frameName}>
          {frameName}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {Math.round(frameSize.width)} × {Math.round(frameSize.height)}
        </div>
      </div>
    </Card>
  );
}
