# SnapFlow 智能体 API 接入说明

## 1. 配置三个子智能体

复制 `.env.example` 为 `.env.local`，分别填写三个智能体的 API 地址和密钥。密钥只在服务端读取，不会返回到网页。

每个外部智能体需要接受 `POST application/json`：

```json
{
  "task_id": "product-white-bg_...",
  "parent_task_id": "fashion_...",
  "agent_id": "product-white-bg",
  "prompt": "当前后台保存的提示词",
  "input": {},
  "parameters": {},
  "metadata": {}
}
```

成功时统一返回：

```json
{
  "status": "succeeded",
  "task_id": "供应商任务 ID（可选）",
  "output": {
    "url": "https://example.com/result.png"
  }
}
```

## 2. SnapFlow 对外接口

- `GET /api/agents/status`：检查三个智能体是否已配置。
- `POST /api/agents/product-white-bg/run`：单独运行白底净图智能体。
- `POST /api/agents/hollow-look/run`：单独运行镂空穿搭智能体。
- `POST /api/agents/snap-change-video/run`：单独运行视频智能体。
- `POST /api/pipeline/run`：父智能体运行完整流水线。

单智能体请求：

```json
{
  "input": { "image": "https://example.com/product.jpg" },
  "parameters": { "aspectRatio": "1:1" },
  "retryLimit": 2
}
```

完整流水线请求：

```json
{
  "looks": [
    { "id": "look-1", "productImages": ["图片 URL 1", "图片 URL 2"] },
    { "id": "look-2", "productImages": ["图片 URL 3"] }
  ],
  "identityReference": "人物参考图 URL",
  "motionReference": "响指动作视频 URL",
  "parameters": {
    "snap-change-video": { "duration": 10, "aspectRatio": "9:16", "fps": 30 }
  }
}
```

父接口会先并行处理所有白底商品图，再逐套生成镂空穿搭，最后生成视频。任一上游失败都会停止下游，并返回完整 `children` 父子结果树。
