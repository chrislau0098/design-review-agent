import { Card, CardContent } from '@/ui/components/ui/card';
import { Badge } from '@/ui/components/ui/badge';
import { Button } from '@/ui/components/ui/button';
import { Separator } from '@/ui/components/ui/separator';
import { Crosshair, ExternalLink } from 'lucide-react';
import type { Finding, Severity } from '@/lib/api-contract';

const SEVERITY_VARIANT: Record<Severity, 'p0' | 'p1' | 'p2'> = {
  P0: 'p0',
  P1: 'p1',
  P2: 'p2',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  P0: 'P0 阻塞',
  P1: 'P1 体验伤',
  P2: 'P2 nice-to-have',
};

interface FindingsListProps {
  findings: Finding[];
  dimensionLabel: string;
  onInspect: (finding: Finding) => void;
}

export function FindingsList({ findings, dimensionLabel, onInspect }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-6 border rounded-md">
        本维度没有 findings · 设计稿视觉层级 OK
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-0.5">
        {dimensionLabel} · {findings.length} 条 findings
      </div>
      {findings.map((f, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold tabular-nums shrink-0">
                #{i + 1}
              </div>
              <Badge variant={SEVERITY_VARIANT[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
              {f.category && (
                <Badge variant="outline" className="text-[10px] font-normal normal-case tracking-normal">
                  {f.category}
                </Badge>
              )}
              <div className="flex-1" />
              {f.nodeIds && f.nodeIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onInspect(f)}
                >
                  <Crosshair className="w-3 h-3" />
                  Inspect
                </Button>
              )}
            </div>

            <div className="space-y-2 text-xs leading-relaxed">
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-0.5">现象</div>
                <div>{f.description}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-0.5">建议</div>
                <div>{f.suggestion}</div>
              </div>
              {f.principle && (
                <>
                  <Separator />
                  <div className="flex items-start gap-1.5 pt-0.5">
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                        引用原则
                      </div>
                      <div className="text-[11px] text-muted-foreground italic">{f.principle}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
