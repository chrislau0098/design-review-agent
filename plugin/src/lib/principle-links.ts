// Principle 引用 → 官方 URL 白名单映射
// Doubao 输出的 principle 是自然语言 · 我们做 pattern match · 只对公认标准提供可点链接
// 避免让 LLM 输出 URL(易幻觉)· 也避免用户点到 404

interface PrincipleLink {
  patterns: RegExp[];
  url: string;
  label: string;
}

const PRINCIPLE_LINKS: PrincipleLink[] = [
  {
    patterns: [/WCAG\s*2\.\d/i, /WCAG/i, /w3\.org/i],
    url: 'https://www.w3.org/WAI/WCAG21/quickref/',
    label: 'W3C WCAG',
  },
  {
    patterns: [/Fitts?['']?s?\s*(?:Law|定律)/i, /费茨/i],
    url: 'https://en.wikipedia.org/wiki/Fitts%27s_law',
    label: "Fitts's Law · Wikipedia",
  },
  {
    patterns: [/Hick(?:'?s)?\s*(?:Law|定律)/i, /希克/i],
    url: 'https://en.wikipedia.org/wiki/Hick%27s_law',
    label: "Hick's Law · Wikipedia",
  },
  {
    patterns: [/Gestalt/i, /格式塔/i, /近邻远疏/i, /Proximity/i, /相似性/i, /连续性原则/i],
    url: 'https://en.wikipedia.org/wiki/Gestalt_psychology',
    label: 'Gestalt Principles',
  },
  {
    patterns: [/Nielsen/i, /Norman/i, /(10|十)\s*(?:大)?(?:可用性|Usability)/i, /启发式/i],
    url: 'https://www.nngroup.com/articles/ten-usability-heuristics/',
    label: 'Nielsen 10 Heuristics',
  },
  {
    patterns: [/Material\s*Design/i, /Material 3/i, /MD3/i],
    url: 'https://m3.material.io/',
    label: 'Material Design',
  },
  {
    patterns: [/iOS\s*HIG/i, /Apple\s*HIG/i, /Human\s*Interface\s*Guidelines/i, /HIG/i],
    url: 'https://developer.apple.com/design/human-interface-guidelines',
    label: 'Apple HIG',
  },
  {
    patterns: [/Refactoring\s*UI/i],
    url: 'https://www.refactoringui.com/',
    label: 'Refactoring UI',
  },
];

export function resolvePrincipleLink(principle: string): { url: string; label: string } | null {
  if (!principle) return null;
  for (const entry of PRINCIPLE_LINKS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(principle)) {
        return { url: entry.url, label: entry.label };
      }
    }
  }
  return null;
}
