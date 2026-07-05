# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/) format.
Conventional Commits: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`.

## [Unreleased]

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
