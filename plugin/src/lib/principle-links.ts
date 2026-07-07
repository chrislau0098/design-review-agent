// Principle 引用 → 官方 URL 白名单映射
// Doubao 输出的 principle 是自然语言 · 我们做 pattern match · 只对公认标准提供可点链接
// 优先 Laws of UX(Chris 补充的权威 UX 定律网站)· fallback 到 Wikipedia / 官方 spec

interface PrincipleLink {
  patterns: RegExp[];
  url: string;
  label: string;
}

// 排序:更 specific 的 pattern 在前
const PRINCIPLE_LINKS: PrincipleLink[] = [
  // ── Laws of UX(优先 · Chris 指定权威源)
  { patterns: [/Fitts?['']?s?\s*(?:Law|定律)/i, /费茨/i], url: 'https://lawsofux.com/fitts-law/', label: "Fitts's Law · Laws of UX" },
  { patterns: [/Hick(?:'?s)?\s*(?:Law|定律)/i, /希克/i], url: 'https://lawsofux.com/hicks-law/', label: "Hick's Law · Laws of UX" },
  { patterns: [/Miller('?s)?\s*(?:Law|定律)/i, /米勒/i], url: 'https://lawsofux.com/millers-law/', label: "Miller's Law · Laws of UX" },
  { patterns: [/Jakob('?s)?\s*(?:Law|定律)/i], url: 'https://lawsofux.com/jakobs-law/', label: "Jakob's Law · Laws of UX" },
  { patterns: [/Tesler('?s)?\s*(?:Law|定律|Complexity)/i, /复杂度守恒/i], url: 'https://lawsofux.com/tesler-s-law/', label: "Tesler's Law · Laws of UX" },
  { patterns: [/Zeigarnik/i, /蔡加尼克/i], url: 'https://lawsofux.com/zeigarnik-effect/', label: 'Zeigarnik Effect · Laws of UX' },
  { patterns: [/Doherty/i], url: 'https://lawsofux.com/doherty-threshold/', label: 'Doherty Threshold · Laws of UX' },
  { patterns: [/Aesthetic[-\s]?Usability/i, /美感[- ]?可用性/i], url: 'https://lawsofux.com/aesthetic-usability-effect/', label: 'Aesthetic-Usability · Laws of UX' },
  { patterns: [/Von\s+Restorff/i, /隔离效应/i, /孤立效应/i], url: 'https://lawsofux.com/von-restorff-effect/', label: 'Von Restorff Effect · Laws of UX' },
  { patterns: [/Serial\s*Position/i, /首因近因/i, /序位效应/i], url: 'https://lawsofux.com/serial-position-effect/', label: 'Serial Position · Laws of UX' },
  { patterns: [/Peak[-\s]?End/i, /峰终定律/i], url: 'https://lawsofux.com/peak-end-rule/', label: 'Peak-End Rule · Laws of UX' },
  { patterns: [/Occam('?s)?\s*Razor/i, /奥卡姆剃刀/i], url: 'https://lawsofux.com/occams-razor/', label: "Occam's Razor · Laws of UX" },
  { patterns: [/Postel('?s)?\s*Law/i], url: 'https://lawsofux.com/postels-law/', label: "Postel's Law · Laws of UX" },
  { patterns: [/Pareto/i, /(80\/20|二八法则)/i], url: 'https://lawsofux.com/pareto-principle/', label: 'Pareto Principle · Laws of UX' },
  { patterns: [/Parkinson/i, /帕金森/i], url: 'https://lawsofux.com/parkinsons-law/', label: "Parkinson's Law · Laws of UX" },
  { patterns: [/Chunking/i, /分块/i, /组块/i], url: 'https://lawsofux.com/chunking/', label: 'Chunking · Laws of UX' },

  // ── Gestalt(Laws of UX 分多个 principle · 就近映射)
  { patterns: [/(?:Law\s+of\s+)?Proximity/i, /近邻/i, /接近性原则/i], url: 'https://lawsofux.com/law-of-proximity/', label: 'Law of Proximity · Laws of UX' },
  { patterns: [/(?:Law\s+of\s+)?Similarity/i, /相似性原则/i], url: 'https://lawsofux.com/law-of-similarity/', label: 'Law of Similarity · Laws of UX' },
  { patterns: [/(?:Law\s+of\s+)?Common\s*Region/i, /共同区域/i], url: 'https://lawsofux.com/law-of-common-region/', label: 'Common Region · Laws of UX' },
  { patterns: [/(?:Law\s+of\s+)?Uniform\s*Connectedness/i, /均匀连接/i], url: 'https://lawsofux.com/law-of-uniform-connectedness/', label: 'Uniform Connectedness · Laws of UX' },
  { patterns: [/(?:Law\s+of\s+)?Pr(a|ä)gnanz/i, /简洁性原则/i], url: 'https://lawsofux.com/law-of-pragnanz/', label: 'Law of Prägnanz · Laws of UX' },
  { patterns: [/Gestalt/i, /格式塔/i, /近邻远疏/i], url: 'https://lawsofux.com/law-of-proximity/', label: 'Gestalt · Laws of UX' },

  // ── 权威 spec(不在 Laws of UX 里)
  { patterns: [/WCAG\s*2\.\d/i, /WCAG/i], url: 'https://www.w3.org/WAI/WCAG21/quickref/', label: 'W3C WCAG 2.1' },
  { patterns: [/Nielsen/i, /(10|十)\s*(?:大)?(?:可用性|Usability)\s*(?:Heuristic|启发式)/i, /启发式评估/i], url: 'https://www.nngroup.com/articles/ten-usability-heuristics/', label: 'Nielsen 10 Heuristics' },
  { patterns: [/Material\s*Design/i, /Material\s*3/i, /MD3/i], url: 'https://m3.material.io/foundations', label: 'Material Design' },
  { patterns: [/iOS\s*HIG/i, /Apple\s*HIG/i, /Human\s*Interface\s*Guidelines/i, /HIG/i], url: 'https://developer.apple.com/design/human-interface-guidelines', label: 'Apple HIG' },
  { patterns: [/Refactoring\s*UI/i], url: 'https://www.refactoringui.com/', label: 'Refactoring UI' },
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

// URL 域白名单 · sandbox 侧 openExternal 时再校验一次
// 支持任意 subdomain(en.wikipedia.org · m3.material.io · developer.apple.com)
export const ALLOWED_URL_HOSTS = [
  'lawsofux.com',
  'w3.org',
  'wikipedia.org',
  'nngroup.com',
  'material.io',
  'apple.com',
  'refactoringui.com',
];
