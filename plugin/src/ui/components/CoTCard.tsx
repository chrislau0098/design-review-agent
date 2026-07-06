import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card';
import { Skeleton } from '@/ui/components/ui/skeleton';
import { Loader2, Sparkles } from 'lucide-react';

interface CoTCardProps {
  dimensionLabel: string;
  step: 'sending' | 'thinking' | 'generating';
}

// M2 pseudo CoT · M3a 接 Doubao reasoning_content stream 时真 CoT 实况
const STEP_TEXT: Record<CoTCardProps['step'], string> = {
  sending: '打包设计稿 → 发送后端…',
  thinking: 'AI 阅读设计稿 · 建立视觉层级模型…',
  generating: '生成 findings · 分级严重度…',
};

export function CoTCard({ dimensionLabel, step }: CoTCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          正在评审 · {dimensionLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {STEP_TEXT[step]}
        </div>
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}
