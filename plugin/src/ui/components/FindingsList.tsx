import { Badge } from '@/ui/components/ui/badge';
import { Crosshair, ArrowUpRight } from 'lucide-react';
import type { Finding, Severity } from '@/lib/api-contract';
import { resolvePrincipleLink } from '@/lib/principle-links';

const SEVERITY_VARIANT: Record<Severity, 'p0' | 'p1' | 'p2'> = {
  P0: 'p0',
  P1: 'p1',
  P2: 'p2',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  P0: 'P0 阻塞',
  P1: 'P1 体验伤',
  P2: 'P2 优化',
};

interface FindingsListProps {
  findings: Finding[];
  dimensionLabel: string;
  onInspect: (finding: Finding) => void;
  onOpenPrincipleUrl: (url: string) => void;
}

// impeccable · Card 减重感 · flat container · 内部靠 separator + spacing 分层
export function FindingsList({
  findings,
  dimensionLabel,
  onInspect,
  onOpenPrincipleUrl,
}: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="text-[12px] text-muted-foreground text-center py-8">
        本维度没有 findings · 设计稿视觉层级 OK
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 pb-1 font-medium">
        {dimensionLabel} · {findings.length} 条 findings
      </div>
      <div className="space-y-2">
        {findings.map((f, i) => {
          const principleLink = f.principle ? resolvePrincipleLink(f.principle) : null;
          const hasInspect = f.nodeIds && f.nodeIds.length > 0;

          return (
            <div
              key={i}
              className="rounded-lg bg-card border border-border/60 overflow-hidden transition-colors duration-150 ease-out-quart hover:border-border"
            >
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/50">
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 min-w-[16px]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Badge variant={SEVERITY_VARIANT[f.severity]} dot>
                  {SEVERITY_LABEL[f.severity]}
                </Badge>
                {f.category && (
                  <span className="text-[11px] text-muted-foreground">{f.category}</span>
                )}
                <div className="flex-1" />
                {hasInspect && (
                  <button
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 ease-out-quart"
                    onClick={() => onInspect(f)}
                  >
                    <Crosshair className="w-3 h-3" />
                    Inspect
                  </button>
                )}
              </div>

              <div className="px-3.5 py-3 space-y-3">
                <div className="text-[12.5px] leading-[1.6]">{f.description}</div>

                <div className="rounded-md bg-muted/50 px-3 py-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    建议
                  </div>
                  <div className="text-[12.5px] leading-[1.55]">{f.suggestion}</div>
                </div>

                {f.principle && (
                  <div className="flex items-start gap-2 pt-0.5">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0 pt-0.5">
                      引用
                    </div>
                    <div className="text-[11.5px] text-muted-foreground leading-[1.55] flex-1">
                      <span className="italic">{f.principle}</span>
                      {principleLink && (
                        <>
                          {' '}
                          <button
                            className="inline-flex items-center gap-0.5 text-foreground/75 hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors duration-150 ease-out-quart"
                            onClick={() => onOpenPrincipleUrl(principleLink.url)}
                          >
                            {principleLink.label}
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

