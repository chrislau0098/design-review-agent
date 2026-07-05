# Base 设计评审 Agent

Figma 插件 + Backend Agent · 火山方舟 Doubao Seed 2.1 驱动 · onBeacon 风格设计稿评审。

## 目录结构

```
/
├── plugin/          # Figma plugin(create-figma-plugin + Preact + TypeScript)
├── backend/         # Backend Agent(Next.js 15 App Router + Vercel AI SDK)
├── docs/
│   ├── api-contract.md    # Backend ↔ Plugin 契约(Planner 锁死)
│   └── changelog.md       # 版本变更
└── .gitignore       # 硬红线严禁 API key 进 git
```

## 本地开发

### Backend

```bash
cd backend
npm install
cp .env.local.example .env.local
# 填 ARK_API_KEY / MODEL_ID_LIGHT / MODEL_ID_DEEP
npm run dev   # localhost:3000
```

### Plugin

```bash
cd plugin
npm install
npm run watch   # 打开 Figma Desktop → Plugins → Development → Import plugin from manifest
```

## 部署

```bash
cd backend
vercel --prod --regions sin1
# 在 Vercel Dashboard 填环境变量
```

## 硬红线

**API key 严禁进 git tracked 文件**。全部走 `.env.local`(已在 .gitignore)+ Vercel 环境变量。
