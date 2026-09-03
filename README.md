# LUMERA 电商视觉工场

LUMERA 是一个面向电商素材生产的 AI 工作台，将商品图处理、真人试穿与动态视频生成组织为可分步确认的生产流程。

## 主要功能

- 上传人物基准图和多套商品素材。
- 生成标准商品净图。
- 组合每套造型并生成真人试穿结果。
- 选择视频模板，生成响指变装等动态商拍视频。
- 在管理后台维护模型服务、提示词、视频模板和生成记录。

## 页面入口

- `/`：品牌首页与功能展示
- `/studio`：分步制作工作台
- `/admin`：运营与模型服务管理
- `/history`：项目与生成记录
- `/pricing`：订阅价格

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

然后打开 `http://localhost:3000`。

## API 配置

复制 `.env.example` 为 `.env.local`，再填写对应的服务地址和访问密钥：

- `ORCHESTRATOR_AGENT_URL` / `ORCHESTRATOR_AGENT_TOKEN`
- `WHITE_BG_AGENT_URL` / `WHITE_BG_AGENT_TOKEN`
- `HOLLOW_LOOK_AGENT_URL` / `HOLLOW_LOOK_AGENT_TOKEN`
- `SNAP_VIDEO_AGENT_URL` / `SNAP_VIDEO_AGENT_TOKEN`
- `NEXT_PUBLIC_DIFY_CHATBOT_TOKEN`：Dify 网页客服嵌入 token

`.env.local` 和 `.env.production` 已被 Git 忽略，不要把真实 API 密钥写入源码或提交到 GitHub。

## 构建与启动

```bash
npm run build
npm run start:standalone
```

生产环境请在托管平台的环境变量中配置 API 密钥，不要上传本地环境文件。
