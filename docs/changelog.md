# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/) format.
Conventional Commits: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`.

## [Unreleased]

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
