# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/) format.
Conventional Commits: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`.

## [Unreleased]

## [v0.2.4] · 2026-07-07 · M2.5.4 · Progress asymptote + timeout + 圆角 badge

### Fixed
- **Progress bar 满死不动**(用户报截图 · 14m 综合评审段 progress 到 100% 静止)
  - 段内插值 `Math.min(sec/est, 1)` → `1 - Math.exp(-sec/est)` 渐近曲线
  - 每段留 3% buffer · 段内 progress 永不满
  - + CSS shimmer 覆盖动画 · filled 部分永远视觉动感(1.8s 循环)
- **无限 spinner**(Vercel 300s 断连但前端不识别)
  - runReview 加 SSE inactivity 检测(300s 无 event 自动 abort + toast)
  - `onDone` callback 兜底 · reviewing phase 未收到 done event → 显式转 error 报「评审未完成 · 连接提前中断」
- **复杂 Component 卡死**(用户报 · 解绑组件后正常)
  - `extractStructure` 加 `MAX_STRUCTURE_DEPTH = 8` · 避免 nested instance 无限递归撑爆 payload
  - Doubao prompt 强化 nodeIds 输出规则:**优先叶子 · 不选顶层容器 · 单 finding 1-3 个 id 最佳**

### Changed
- Inspect 按钮文案 → **定位**(Chris 指定 · 更本地化)
- Findings 卡片段落间距:`space-y-3.5` → `space-y-5` · 现象 / 建议 / 引用 三段更松弛
- Badge 圆角:`rounded-md` → `rounded-full` pill 全圆角 · 移除 border · 浅底 8-12% chroma · 视觉重量匹配 shadcn `secondary`

## [v0.2.3] · 2026-07-07 · M2.5.3 · 页面布局 dimension + principle URL 命中

### Added (Backend)
- 新 `page-layout` dimension · 融合 visual-hierarchy + information-grouping 两大检查点(Chris 反馈信息分组和视觉层级应该一起评审)· 单次调用一次输出两维度 findings
- Prompt 明确要求 principle 优先引用 English 定律 keyword(Fitts's Law / Gestalt / WCAG / Nielsen / Prägnanz / Von Restorff / Miller's Law 等 20+ 个)· 便于自动映射
- Prod 实测:page-layout 5 条 findings · principle **5/5 全部命中 URL 白名单**

### Fixed (Plugin)
- Radio 卡片右上角 check 圆点遮盖 eta 文字(用户报「1-2 mi_」被截断)· 改用 border-foreground/85 + inset shadow 表示选中态 · 无 check 圆点
- 首页维度选择 · 改用 Chris 定义的分类:
  - ✅ 页面布局(唯一 enabled · backend page-layout)
  - ⏳ Base 设计规范 / 多语言适配 / 文案表达(全部 Coming Soon)
- Findings 正文字号 15px → **14px**(Chris 指定)
- Badge padding · `py-0.5 leading-none` → `py-1 leading-normal`(Chris:高度太窄不舒服)

### Added (Plugin)
- 中文宽松兜底 pattern 到 principle-links:「层级」/「对比」/「间距」/「一致性」/「近邻远疏」等中文 keyword 也映射到 Refactoring UI / Nielsen / Laws of UX(即使 Doubao 输出中文表述 · 也保证 principle 至少有一个 fallback URL 可跳)

## [v0.2.2] · 2026-07-07 · M2.5.2 · UX 8 条修复

### Fixed
- **Principle 链接打不开**(用户报)· 白名单 regex 只放行 `wikipedia.org` / `www.wikipedia.org` · 漏了 `en.wikipedia.org`
  - Sandbox 侧改用 `new URL()` parse + `hostname.endsWith(`.${suffix}`)` · 支持任意 subdomain
  - 顺便加 `lawsofux.com` 白名单 · 优先映射到 Laws of UX 权威分类页(Fitts / Hick / Miller / Jakob / Tesler / Gestalt 全套 + 隔离/序位/峰终/奥卡姆/Pareto/组块 等 20+ 条)
- **底部常驻横向 scrollbar**(用户报)· HistorySheet `absolute` 撑宽 body → root `overflow: hidden`
- App container 加 `overflow-hidden`(双保险)

### Changed (Plugin UI · Chris 反馈 5 条)
- **评审深度 → Radio 卡片**:「快速」+ 「深度」· 每卡片含标题 / 图标 / 预估耗时(1–2 min / 5–8 min) / 一句说明(初版排查 / 深度分析)· active 有右上打勾
- **新增评审维度 Radio 卡片**:「视觉层级」/「信息分组」可选 · 「Design Token」/「设计组件规范」disabled + `Coming Soon` badge
- **CoT 段可展开折叠 accordion**:每段 header 可点击 · chevron 显示旋转 · active 段默认展开 · 用户可手动切换查看子任务
- **Progress bar 加粗** 3px → 4px + foreground/85 · 视觉存在感提升
- **Findings 正文 12.5px → 15px** · 「建议」区块移除背景块 padding · 与「现象」左对齐 · 只用 tiny label 分层
- **文案**:P1「体验伤」→「重点关注」· P2「nice-to-have」/「优化」→「可优化」
- **Badge 一致 shadcn 化**:P0/P1/P2 统一 outline + `bg-severity-*/10-12` + colored text · 相同视觉重量 · 移除 dot 前缀

### Changed (Backend)
- `information-grouping` prompt 从 stub 提上来到 visual-hierarchy 同等质量(用户可在 UI 选此维度)
- 覆盖:同类聚合 / 分组边界 / 卡片粒度 / 内容层级 / 空态一致性 / 反例
- Prod redeployed

## [v0.2.1] · 2026-07-07 · M2.5.1 · Bug fixes + impeccable UI

### Fixed (Plugin)
- **Bug 1**:Inspect 触发的 `selectionchange` 覆盖 findings 视图
  - Sandbox 侧加 800ms race guard(`muteSelectionChangeUntil`)· Inspect 前设置 · 期内 selectionchange 忽略
  - UI 侧 reviewing/done/viewing-history phase 直接 ignore `FRAME_SELECTED`(双保险)
- **Bug 3**:principle 引用无可点链接
  - 新 `principle-links.ts` · 白名单 pattern match(WCAG / Fitts / Nielsen / Material / iOS HIG / Gestalt / Refactoring UI)
  - Sandbox 侧再校验 URL host · 只放行白名单域 · `figma.openExternal`

### Added (Plugin)
- **评审历史**(Bug 2 请求)
  - `figma.clientStorage` 存 20 条 FIFO · header 加 Clock 按钮显示条数
  - `HistorySheet` 从右滑入 · 列表点击进 `viewing-history` phase · 保留 Inspect 功能
  - Chris 反馈的「历史生成的判断」

### Changed (Plugin · impeccable UI 系统改造)
- **OKLCH 色系**替代 HSL · 冷调 tint 中性色(chroma 0.005-0.02)· 无 `#fff`/`#000`
- **Badge 减饱和**:P0/P1/P2 用 muted rose/honey/slate + dot 前缀 · 不再 fill 高饱和背景
- **Card 减 elevation**:border 淡化(`border-border/60`)· 无 shadow · flat container · 内部 rounded muted bg 区分「建议」段(消除 side-stripe)
- **Progress**:3px 细线 · foreground/70 subtle · 250ms ease-out-quart
- **系统字体栈**:`-apple-system` 先 · Inter fallback · 无 display font
- **Motion**:transition-colors 150ms ease-out-quart 标准化
- **Findings 卡** 序号 `01 02 03` 单空格 monospace · 消除彩色圆形 badge
- **Scrollbar**:8px thin · macOS 风

### Impeccable 合规
- No side-stripe borders greater than 1px
- No gradient text · no glassmorphism decoration(HistorySheet backdrop-blur-2px 作 modal 覆盖层不算装饰)
- No identical card grids · no nested cards
- Colors OKLCH · low chroma at extremes
- Familiar patterns · restrained accent(仅 primary action / current selection)

## [v0.2.0] · 2026-07-07 · M2.5 · CoT streaming + Inspect + finding metadata

### Added (Backend)
- ARK API 切 `stream: true` · 消费 `reasoning_content` + `content` 增量 chunks · 用于 stage transition 时机判定
- `stage_progress` SSE event · 3 段(context → analyzing → synthesizing)· 首个 reasoning chunk 触发 analyzing · 首个 content chunk 触发 synthesizing
- Request 加 `frameStructure`(可选 · v0.3)· backend 拼进 prompt 后半段 · 让 Doubao 引用 node id
- Finding 加 `principle` / `category` / `nodeIds` 三个可选字段 · JSON schema strict mode required · 空值由前端 hide

### Changed (Backend)
- Prompt 重构 · 强制 finding 输出 principle / category / nodeIds · anti-hallucination:不确定就留空
- Provider abstraction 内部改用 streaming path · 上层 `ModelProvider` 接口不变

### Added (Plugin)
- 完全重写 CoT 卡片 · shadcn Progress 分段进度条 + 3 段 collapsible · 完成折叠打勾 · 进行中展开子任务列表(参考 onBeacon Reviewing your design 布局)
- FindingsList 加 `#N` 序号 badge + category badge + Inspect 按钮 + Source 引用原则区块
- Inspect 按钮:精确 nodeId 匹配 → `figma.viewport.scrollAndZoomIntoView` · fallback fuzzy 匹配 characters/name · 兜底定位 Frame · toast 提示匹配结果
- Frame 结构递归提取(`src/figma/main.ts`)· 保留 semantic 节点 · 面积降序 · 上限 150

### Changed (Plugin)
- 容器 340×560 → 400×720
- Base font 12 → 13px · 卡片 padding p-3 → p-4
- shadcn Progress 组件加入 · 简化版(不依赖 Radix Portal)

### Verified (Prod)
- End-to-end streaming test 3 阶段 emit 时机:
  - `stage_progress: context` · +2.9s(dimension_started 后立即)
  - `stage_progress: analyzing` · +6.7s(Doubao 首个 reasoning chunk)
  - `stage_progress: synthesizing` · +180.4s(Doubao 首个 content chunk)
  - findings 到齐 · +188.4s
- 5 条 findings · category 5/5 · nodeIds 4/5 有引用 · principle 2/5(anti-hallucination 正常)
- 引用的 nodeIds 100% 都是实际存在的 frame structure id · 无幻觉

## [v0.1.0] · 2026-07-06 · M1 · 单维度跑通

### Added
- `backend/` Next.js 15 App Router scaffold(react 18 · TS strict · sin1 region)
- Provider abstraction 层:`src/lib/model-provider.ts` `ModelProvider` interface + `VercelAISDKProvider` 实现(为 Mastra 迁移预留 · 业务代码 0 处直接 import model client)
- `POST /api/review` SSE stream:`dimension_started` → `finding_delta` × N → `dimension_done` → `done` + sessionId
- 6 dimension registry(`src/lib/dimensions.ts`) · visual-hierarchy 真中文 prompt 完成 · 其他 stub 到 M3a 补
- Error taxonomy 8 code(`src/lib/errors.ts`)· invalid_dimensions / image_too_large / unsupported_image / auth_misconfigured / model_schema_error / upstream_rate_limited 有实际触发路径 · timeout / partial_failure 留桩
- 图片双门约束:客户端 4.5MB base64 上限 + 服务端 413 拦截 + PNG magic bytes check(400 unsupported_image)
- CORS preflight OPTIONS 200 + `Access-Control-Allow-Origin: *`
- Doubao Seed 2.1 Turbo 集成:VercelAISDKProvider 内部直接 fetch ARK `response_format: json_schema`(SDK generateObject 兼容不到位,已 workaround)
- Vercel deploy 到 chris-laus-projects/design-review-agent · production alias `design-review-agent.vercel.app`

### Changed
- `maxDuration` 800 → 300 · Vercel Team/Hobby plan 硬顶 300s · M3a 6 并行前需 Chris 决策升级 Pro
- `vercel.json` 只保留 `regions: ["sin1"]` · `maxDuration` 走 App Router segment config(`export const maxDuration = 300`)

### Verified
- Local curl SSE stream:5/5 通过 · 首次返 4 条真实 findings(P1×1 + P2×3)· 内容质量高
- Local wall time min/max/P50/P95 = 70s / 157s / 131s / 157s(Doubao thinking mode 默认开 · 生成 ~2700 reasoning tokens)
- Doubao 2.1 Turbo `response_format: json_schema` strict mode 兼容度:PASS
- 详细数据:`agent-log/2026-07-06-m1-probe.md`

### Verified (Prod · 07:12 SSO 关后)
- Prod `POST /api/review` 端到端 SSE stream 干净 · 148.9s wall · 5 条真实 findings
- **sin1 → cn-beijing TTFE P95 = 2,805 ms · < 5s exit criteria · 47% headroom**
- 5 samples 极稳定(min 2.6s / max 2.8s / std < 100ms)· Vercel Fluid Compute cold start 一致

### Fixed (Prod 部署链路)
- Vercel 项目 `rootDirectory` 未设 · GitHub push 自动部署 build 空跑 · endpoint 404 · 修:PATCH `rootDirectory: "backend"` + `framework: "nextjs"` + 强制 redeploy
- Vercel prod `ARK_API_KEY` env var 值曾误提交为空(昨晚 add 时空 Enter)· backend fetch ARK 挂 · 修:Chris 手动 Dashboard 补正 + redeploy

## [v0.0.2] · 2026-07-06 · API contract v0.2(codex review 修订)

### Changed
- `docs/api-contract.md` v0.1 → v0.2 · 集成 codex review 5 P0 blocker + P1 建议:
  - **P0-1** Request 字段 `dimension` → `dimensions: string[]` 统一(即使单元素也数组)
  - **P0-2** Response 从「JSON delta」空口白话 → 定义 SSE event types:`dimension_started` / `finding_delta` / `dimension_done` / `error` / `done` + 客户端 merge 规则 + partial-result streaming
  - **P0-4** Concurrency 策略明确 · `p-limit` 起 concurrency 2 · 硬上限 3 · 单维度 timeout 30s · 指数退避 retry base 1s max 3 次

### Added
- Error taxonomy(8 code):`invalid_dimensions` / `image_too_large` / `unsupported_image` / `model_schema_error` / `model_timeout` / `partial_failure` / `auth_misconfigured` / `upstream_rate_limited`
- JSON schema fallback 链:schema 不符 → markdown mode retry → 标 failedDimensions
- Provider abstraction 设计(为阶段 B Mastra 迁移预留)· `ModelProvider` + `SessionStore` interface 从 M1 就要写,业务代码不直接 import ai-sdk / Redis client
- 图片大小上限硬约束 · 客户端 sizing + 服务端 413 双门

## [v0.0.1] · 2026-07-05 · Repo init

### Added
- `.gitignore` 硬红线(API key / .env / node_modules / .next / .vercel / .DS_Store)
- `docs/api-contract.md` v0.1 API 契约锁死
- `docs/changelog.md`
- `README.md`
