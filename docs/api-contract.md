# API Contract · Backend ↔ Plugin

**版本**:v0.3(2026-07-07 · M2.5 · streaming + frameStructure + finding metadata)
**Owner**:Planner-Claude
**Breaking change 政策**:M3a 前锁死,M3a+ 加字段 non-breaking。

## POST /api/review

### Request

```typescript
{
  imageBase64: string;          // Frame export PNG base64,无 data: prefix
  dimensions: string[];         // 数组,即使单元素也传数组 · 见下方枚举
  mode: "light" | "deep";       // 轻量 Turbo / 深度 Pro
  sessionId?: string;           // M4+ 追问用
  message?: string;             // M4+ 用户追问文本
  frameStructure?: FrameStructureNode[];  // v0.3 · Frame 节点结构 · 用于 Inspect 定位
}

interface FrameStructureNode {
  id: string;                                // Figma node id (e.g. "1:23")
  name: string;
  type: string;                              // FRAME / TEXT / COMPONENT / RECTANGLE ...
  characters?: string;                       // 仅 TEXT · 前 60 字
  bbox: [number, number, number, number];    // [x_norm, y_norm, w_norm, h_norm] 相对 Frame [0,1]
}
```

**frameStructure 说明**(v0.3):
- Plugin traverse Frame · 按 bbox 面积从大到小选 top 150 nodes
- Backend 硬上限 200 · 超过丢尾
- 传给 Doubao 作为「节点结构」上下文 · 模型引用相关 node id 到 finding.nodeIds
- 缺省(向后兼容 v0.2 客户端)· backend 视为无结构上下文 · nodeIds 空数组

**dimensions 枚举值**(6 维度):
- `information-grouping` 信息分组
- `visual-hierarchy` 视觉层级
- `color` 配色
- `contrast` 对比度
- `i18n` 多语言
- `copy` 文案

**M1 简化**:M1 只支持单元素 dimensions(`["visual-hierarchy"]`),不强制 6 个全传;M3a 起支持多元素并行编排。

### Response · Server-Sent Events(SSE)

`Content-Type: text/event-stream` · `Cache-Control: no-cache` · `Connection: keep-alive`

每 event 一行 `data: <JSON>\n\n`,event type 通过 JSON payload 的 `type` 字段区分:

```typescript
// event type 1 · dimension 开始
{ type: "dimension_started", dimension: "visual-hierarchy" }

// event type 1.5 · CoT stage 转换(v0.3 新增)· 前端驱动 3 段式进度显示
// 触发条件:
//   context: dimension_started 后立即 emit(打包 + 上下文准备完成)
//   analyzing: 收到 Doubao 首个 reasoning_content chunk
//   synthesizing: 收到 Doubao 首个 content chunk
{ type: "stage_progress", dimension: "visual-hierarchy", stage: "context" | "analyzing" | "synthesizing" }

// event type 2 · finding 增量(每个 finding 是完整对象,不是 partial patch)
// v0.3 · Finding 新增 3 个可选字段
{
  type: "finding_delta",
  dimension: "visual-hierarchy",
  finding: {
    severity: "P0" | "P1" | "P2",
    description: string,
    suggestion: string,
    principle?: string,           // v0.3 · 引用的设计原则一句(不确定留空)
    category?: string,            // v0.3 · 细分类(层级差异/主次对比/间距节奏 ...)
    nodeIds?: string[]            // v0.3 · 引用的 frameStructure node id 数组
  }
}

// event type 3 · dimension 完成
{ type: "dimension_done", dimension: "visual-hierarchy", findingCount: 3 }

// event type 4 · 错误(可以是全局错误,也可以是特定 dimension 错误)
{
  type: "error",
  code: string,           // 见 Error taxonomy
  message: string,
  dimension?: string,      // 特定维度错误时填
  retryable: boolean
}

// event type 5 · 全部完成
{
  type: "done",
  sessionId: string,       // M4+ 后端生成/回显
  summary: {
    completedDimensions: string[],
    failedDimensions: string[],
    totalFindings: number
  }
}
```

#### Merge 规则(客户端)

- 收到 `dimension_started` 建立/清空该维度的 finding 列表
- 收到 `finding_delta` 追加到对应维度的 finding 列表(每个 finding 是完整对象)
- 收到 `dimension_done` 标记该维度渲染完成
- 收到 `error` 显示错误提示(全局或该维度)
- 收到 `done` 收流

#### Partial-result streaming

**必须支持部分维度失败,其他维度继续**。即使 3 个维度成功 2 个超时,`done` 事件也要发,`summary.failedDimensions` 列超时维度。

### Error Taxonomy

| code | HTTP 状态 | 触发条件 | Retryable |
|---|---|---|---|
| `invalid_dimensions` | 400 | dimensions 数组为空 / 有未定义值 | ❌ |
| `image_too_large` | 413 | base64 长度 > 4,500,000 字节 | ❌ |
| `unsupported_image` | 400 | base64 解码失败 / 非 PNG / 尺寸异常 | ❌ |
| `model_schema_error` | 502 + SSE error | 模型返回不符合 JSON schema · fallback 到 markdown | ⚠️ 单次重试 |
| `model_timeout` | 504 + SSE error | 单维度 > 30s 无 response | ✅ 单次重试 |
| `partial_failure` | 200 + SSE done | 部分维度失败(见 `summary.failedDimensions`)| ❌ |
| `auth_misconfigured` | 500 | ARK_API_KEY 缺失或无效 | ❌ · 通知 planner |
| `upstream_rate_limited` | 429 + SSE error | ARK 返回 429 · 指数退避重试 | ✅ 最多 3 次 |

### 图片大小上限 · 硬约束

- **Vercel body size 4.5MB** · base64 后 4,500,000 字节硬上限
- **base64 encoding overhead ~33%** · 原始 PNG 3MB 编码后 4MB(接近上限)
- **Plugin 端硬门**:
  - 建议 `SCALE=2` for 常规 Frame → 编码后 ~1-2MB(安全)
  - 原始 > 2.5MB 时降级到 `SCALE=1` 或 `JPEG q=0.8`
  - 发请求前 check base64.length,超过 4,500,000 直接报错不发
- **Backend server 侧防护**:
  - 请求入立刻校验 `imageBase64.length <= 4_500_000`,超过返 413 `image_too_large`

### CORS

- Backend 必须返 `Access-Control-Allow-Origin: *`
- Plugin `manifest.json` `networkAccess.allowedDomains` 加 backend 域名
- Preflight OPTIONS 返 200 + 上述 header

### Concurrency 策略(backend 内部,M3a 生效)

- 6 维度并行 dispatch 用 `p-limit` 或类似 · **起 concurrency = 2**,压测 ARK 后可调至 3
- 单维度 timeout **30s**(超时触发 `model_timeout` event,不阻塞其他维度)
- 指数退避 retry:base 1s · max 3 次 · 只 retry `upstream_rate_limited` / `model_timeout`
- concurrency > 3 时,ARK 429 概率上升 · 硬上限 3

### JSON schema `response_format`(M3a)

Doubao 输出强制 schema:

```typescript
{
  findings: Array<{
    severity: "P0" | "P1" | "P2";
    description: string;
    suggestion: string;
  }>
}
```

**Fallback 链**:
1. 模型不符合(触发 `model_schema_error`)→ 该维度改用 markdown mode 再跑一次
2. 再失败 → 该维度标 `failedDimensions`

**验证**:M1 冲刺时用 curl 探针一次真图 + JSON schema,确认 Doubao 2.1 Turbo 兼容度。

## Provider Abstraction(为阶段 B Mastra 迁移预留)

Backend 代码里 model calls 走 provider abstraction 层,**不直接 import `@ai-sdk/openai-compatible`**:

```typescript
// backend/src/lib/model-provider.ts
export interface ModelProvider {
  reviewDimension(
    imageBase64: string,
    dimension: string,
    mode: 'light' | 'deep'
  ): AsyncIterable<FindingEvent>;
}

// backend/src/lib/session-store.ts
export interface SessionStore {
  get(sessionId: string): Promise<SessionState | null>;
  set(sessionId: string, state: SessionState): Promise<void>;
  ttl: number;
}
```

**阶段 A**:实现为 `VercelAISDKProvider` + `UpstashRedisSessionStore`
**阶段 B**:切 `MastraProvider` + `MastraMemoryStore`,业务代码不变

这个 boundary 从 M1 就要写好,不是 M5 才加。

## Changelog

- **v0.3**(2026-07-07 · M2.5)
  - Request 加 `frameStructure` · Plugin 提取 Figma node tree(id/name/type/characters/bbox 归一化)
  - Finding 加 `principle` / `category` / `nodeIds` 三可选字段 · 支持 Inspect 定位 + Source 展示
  - SSE event 加 `stage_progress` · 3 段(context / analyzing / synthesizing)· 前端 CoT UI 驱动
  - Backend 切 ARK `stream: true` 消费 reasoning_content + content chunks · 判定 stage transition 时机
  - 硬上限:frameStructure 服务端截断到 200 · client 侧建议 150

- **v0.2**(2026-07-06 · codex review 修订)
  - P0-1 `dimension` → `dimensions: string[]` 统一(即使单元素也数组)
  - P0-2 SSE event types 定义(dimension_started / finding_delta / dimension_done / error / done)+ 客户端 merge 规则 + partial-result streaming
  - P0-4 Concurrency 策略(p-limit 2 起 · 单维度 timeout 30s · 指数退避 retry)
  - P1 Error taxonomy(8 code)
  - P1 Provider abstraction(为 Mastra 迁移预留)
  - P2 图片大小上限硬约束(客户端 + 服务端双门)

- **v0.1**(2026-07-05)· MVP 初版
