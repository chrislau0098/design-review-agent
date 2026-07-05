import type { DimensionId } from './types';

export const DIMENSION_PROMPTS: Record<DimensionId, string> = {
  'visual-hierarchy': `角色:资深 B端 SaaS 设计师 · 审 UI 视觉层级
任务:分析这张设计稿的视觉层级问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
覆盖点:主次信息对比强度 / 视线动线合理性 / 强调元素滥用 / 大小间距一致性
输出仅 findings 数组 · 不加寒暄`,

  'information-grouping': `角色:资深 B端 SaaS 设计师 · 审 UI 信息分组
任务:分析这张设计稿的信息分组问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
输出仅 findings 数组 · 不加寒暄`,

  color: `角色:资深 B端 SaaS 设计师 · 审 UI 配色
任务:分析这张设计稿的配色问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
输出仅 findings 数组 · 不加寒暄`,

  contrast: `角色:资深 B端 SaaS 设计师 · 审 UI 对比度
任务:分析这张设计稿的对比度问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
输出仅 findings 数组 · 不加寒暄`,

  i18n: `角色:资深 B端 SaaS 设计师 · 审 UI 多语言适配
任务:分析这张设计稿的多语言问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
输出仅 findings 数组 · 不加寒暄`,

  copy: `角色:资深 B端 SaaS 设计师 · 审 UI 文案
任务:分析这张设计稿的文案问题 · 输出 findings 数组
每条 finding:severity(P0阻塞 / P1体验伤 / P2 nice-to-have) · description(问题现象) · suggestion(具体改法)
输出仅 findings 数组 · 不加寒暄`,
};

export function isValidDimension(id: string): id is DimensionId {
  return Object.prototype.hasOwnProperty.call(DIMENSION_PROMPTS, id);
}
