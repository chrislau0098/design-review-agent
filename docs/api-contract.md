# API Contract · Backend ↔ Plugin

**版本**:v0.1(MVP · M1 锁死)
**Owner**:Planner-Claude
**Breaking change 政策**:M3 前锁死,M4+ 加字段 non-breaking。

## POST /api/review

### Request

```typescript
{
  imageBase64: string;          // Frame export PNG base64,无 data: prefix
  dimensions: string[];         // 见下方枚举
  mode: "light" | "deep";       // 轻量 Turbo / 深度 Pro
  sessionId?: string;           // M4+ 追问用
  message?: string;             // M4+ 用户追问文本
}
```

**dimensions 枚举值**(6 维度):
- `information-grouping` 信息分组
- `visual-hierarchy` 视觉层级
- `color` 配色
- `contrast` 对比度
- `i18n` 多语言
- `copy` 文案

### Response · Streaming(text/event-stream)

每 chunk 是 JSON delta,客户端合并后得完整结果:

```typescript
{
  dimensions: [
    {
      name: string;             // 对应 request dimensions 元素
      findings: [
        {
          severity: "P0" | "P1" | "P2";
          description: string;  // 问题描述
          suggestion: string;   // 改进建议
        }
      ]
    }
  ];
  sessionId?: string;           // M4+ 后端生成/回显
}
```

### Error(HTTP 4xx/5xx)

```typescript
{
  error: string;    // 错误码(e.g. "invalid_image", "rate_limit", "model_error")
  message: string;  // 人话说明
}
```

### 图片大小上限

- Vercel body size 上限 4.5MB(base64 后)
- Plugin 端 export 建议 `SCALE=2` for 一般 Frame;超 3MB 降到 `SCALE=1` 或 JPEG q=0.8

### CORS

- Backend 必须返 `Access-Control-Allow-Origin: *`
- Plugin manifest.json `networkAccess.allowedDomains` 加 backend 域名

## Changelog

- v0.1(2026-07-05):MVP 初版,M1 锁死
