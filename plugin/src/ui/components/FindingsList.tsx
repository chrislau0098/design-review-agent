import { Card, CardContent, CardHeader } from '@/ui/components/ui/card';
import { Badge } from '@/ui/components/ui/badge';
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
}

export function FindingsList({ findings, dimensionLabel }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        本维度没有 findings · 设计稿视觉层级 OK
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-0.5">
        {dimensionLabel} · {findings.length} 条 findings
      </div>
      {findings.map((f, i) => (
        <Card key={i}>
          <CardHeader>
            <Badge variant={SEVERITY_VARIANT[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed">
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">现象</div>
              <div>{f.description}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">建议</div>
              <div>{f.suggestion}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
