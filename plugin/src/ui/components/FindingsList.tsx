import { Badge } from '@/ui/components/ui/badge';
import { Crosshair, ArrowUpRight } from 'lucide-react';
import type { Finding, Severity } from '@/lib/api-contract';
import { resolvePrincipleLink } from '@/lib/principle-links';

const SEVERITY_VARIANT: Record<Severity, 'p0' | 'p1' | 'p2'> = {
  P0: 'p0',
  P1: 'p1',
  P2: 'p2',
};

// Chris 更新的文案 · P1 → 重点关注 · P2 → 可优化
const SEVERITY_LABEL: Record<Severity, string> = {
  P0: 'P0 阻塞',
  P1: 'P1 重点关注',
  P2: 'P2 可优化',
};

interface FindingsListProps {
  findings: Finding[];
  dimensionLabel: string;
  onInspect: (finding: Finding) => void;
  onOpenPrincipleUrl: (url: string) => void;
}

// 正文 15-16px · 建议与问题正文左对齐(移除 padding block)· 用 small label 而非背景块区分
export function FindingsList({
  findings,
  dimensionLabel,
  onInspect,
  onOpenPrincipleUrl,
}: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="text-[13px] text-muted-foreground text-center py-10">
        本维度没有 findings · 设计稿视觉层级 OK
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 font-medium">
        {dimensionLabel} · {findings.length} 条 findings
      </div>
      <div className="space-y-2.5">
        {findings.map((f, i) => {
          const principleLink = f.principle ? resolvePrincipleLink(f.principle) : null;
          const hasInspect = f.nodeIds && f.nodeIds.length > 0;

          return (
            <div
              key={i}
              className="rounded-lg bg-card border border-border/60 overflow-hidden transition-colors duration-150 ease-out-quart hover:border-border"
            >
              {/* header row */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 min-w-[18px]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Badge variant={SEVERITY_VARIANT[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
                {f.category && (
                  <span className="text-[11.5px] text-muted-foreground">{f.category}</span>
                )}
                <div className="flex-1" />
                {hasInspect && (
                  <button
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 ease-out-quart"
                    onClick={() => onInspect(f)}
                  >
                    <Crosshair className="w-3 h-3" />
                    定位
                  </button>
                )}
              </div>

              {/* body · 现象和建议同一 x 位置(px-4)· 段落间距 space-y-5 更松 */}
              <div className="px-4 pb-4 pt-2 space-y-5">
                <div className="text-[14px] leading-[1.65] tracking-[-0.003em]">
                  {f.description}
                </div>

                <div>
                  <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    建议
                  </div>
                  <div className="text-[14px] leading-[1.65] tracking-[-0.003em]">
                    {f.suggestion}
                  </div>
                </div>

                {f.principle && (
                  <div>
                    <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      引用
                    </div>
                    <div className="text-[12.5px] text-muted-foreground leading-[1.6] italic">
                      {f.principle}
                      {principleLink && (
                        <>
                          {' '}
                          <button
                            className="not-italic inline-flex items-center gap-0.5 text-foreground/75 hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors duration-150 ease-out-quart"
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
