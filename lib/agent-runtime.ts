import { agents, orchestrator } from "./agents";

export type AgentId = "orchestrator" | "product-white-bg" | "hollow-look" | "snap-change-video";

export type AgentRunRequest = {
  taskId?: string;
  parentTaskId?: string;
  input: unknown;
  prompt?: string;
  parameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  connection?: { url?: string; token?: string; model?: string };
};

export type AgentRunResult = {
  taskId: string;
  agentId: AgentId;
  status: "succeeded" | "failed" | "processing";
  output?: unknown;
  error?: string;
  externalTaskId?: string;
  durationMs: number;
  attempts: number;
};

const config: Record<AgentId, { url?: string; token?: string }> = {
  orchestrator: {
    url: process.env.ORCHESTRATOR_AGENT_URL,
    token: process.env.ORCHESTRATOR_AGENT_TOKEN,
  },
  "product-white-bg": {
    url: process.env.WHITE_BG_AGENT_URL,
    token: process.env.WHITE_BG_AGENT_TOKEN,
  },
  "hollow-look": {
    url: process.env.HOLLOW_LOOK_AGENT_URL,
    token: process.env.HOLLOW_LOOK_AGENT_TOKEN,
  },
  "snap-change-video": {
    url: process.env.SNAP_VIDEO_AGENT_URL,
    token: process.env.SNAP_VIDEO_AGENT_TOKEN,
  },
};

export function agentConnectionStatus() {
  return [{ id: "orchestrator", name: orchestrator.name }, ...agents].map((agent) => ({
    id: agent.id,
    name: agent.name,
    connected: Boolean(config[agent.id as AgentId].url),
  }));
}

function createTaskId(agentId: AgentId) {
  return `${agentId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function readableError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.message === "string") return object.message;
    try { return JSON.stringify(value); } catch { return "接口返回了无法解析的错误"; }
  }
  return String(value || "未知错误");
}

function isDeepSeek(url: string) { return new URL(url).hostname.endsWith("deepseek.com"); }
function isRemoveBg(url: string) { return new URL(url).hostname.endsWith("remove.bg"); }
function isModelVerse(url: string) {
  const host = new URL(url).hostname;
  return host.endsWith("modelverse.cn") || host.endsWith("umodelverse.ai");
}
function isArk(url: string) {
  const host = new URL(url).hostname;
  return host.endsWith("volces.com") || host.endsWith("volcengine.com");
}

function findImage(value: unknown): string | undefined {
  if (typeof value === "string" && (/^data:image\//.test(value) || /^https?:\/\//.test(value))) return value;
  if (Array.isArray(value)) for (const item of value) { const found = findImage(item); if (found) return found; }
  if (value && typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) { const found = findImage(item); if (found) return found; }
}

function collectImages(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string" && (/^data:image\//.test(value) || /^https?:\/\//.test(value))) {
    if (!found.includes(value)) found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectImages(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectImages(item, found);
  }
  return found;
}


function parseJsonContent(value: unknown) {
  if (typeof value !== "string") return value;
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch { return value; }
}

async function postAgent(agentId: AgentId, target: { url: string; token?: string; model?: string }, request: AgentRunRequest, taskId: string, prompt: string) {
  console.log(`[SnapFlow] ${agentId} -> ${target.url}${target.model ? ` (model=${target.model})` : " (无model)"} ${target.token ? "(带Key)" : "(无Key)"}`);
  if (agentId === "orchestrator" && isDeepSeek(target.url)) {
    return fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(target.token ? { Authorization: `Bearer ${target.token}` } : {}) },
      body: JSON.stringify({
        model: target.model || "deepseek-v4-pro",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `请根据以下父任务数据完成规划或验收，并用简洁 JSON 输出：\n${JSON.stringify(request.input)}` },
        ],
        stream: false,
        response_format: { type: "json_object" },
      }),
    });
  }

  if (agentId === "product-white-bg" && isRemoveBg(target.url)) {
    const image = (request.input as { image?: unknown })?.image;
    if (typeof image !== "string" || !image.startsWith("data:")) throw new Error("remove.bg 需要上传有效的商品图片");
    const [header, encoded] = image.split(",", 2);
    const mime = header.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
    const bytes = Buffer.from(encoded, "base64");
    const form = new FormData();
    form.append("image_file", new Blob([bytes], { type: mime }), `product.${mime.split("/")[1] || "jpg"}`);
    form.append("size", "auto");
    form.append("bg_color", "white");
    // Users commonly paste the remove.bg homepage or docs URL. Always route this
    // provider through its documented processing endpoint.
    return fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: target.token ? { "X-Api-Key": target.token } : {}, body: form });
  }

  if (agentId === "hollow-look" && (isModelVerse(target.url) || isArk(target.url))) {
    const input = request.input as { image?: unknown; identityReference?: unknown; products?: unknown };
    let images: string[] = [];
    if (typeof input.image === "string") {
      images = [input.image];
    } else {
      const person = findImage(input.identityReference);
      if (person) images.push(person);
      images.push(...collectImages(input.products));
      if (!images.length) {
        const fallback = findImage(request.input);
        if (fallback) images.push(fallback);
      }
    }
    if (!images.length) throw new Error("真人穿搭接口没有收到有效图片");
    const image = images.length === 1 ? images[0] : images;
    return fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(target.token ? { Authorization: `Bearer ${target.token}` } : {}) },
      body: JSON.stringify({
        model: target.model || "Qwen/Qwen-Image-Edit",
        prompt,
        image,
        size: isArk(target.url) ? "1440x2560" : "1080x1920",
        response_format: "b64_json",
      }),
    });
  }

  if (agentId === "snap-change-video" && (isModelVerse(target.url) || isArk(target.url))) {
    const input = request.input as { phase?: string; taskId?: string; lookCount?: number; videoTemplate?: { prompt?: string; referenceVideo?: string } };
    const authorization = target.token || "";
    if (input.phase === "poll" && input.taskId) {
      const statusUrl = target.url.replace(/\/submit\/?$/, "/status");
      return fetch(`${statusUrl}?task_id=${encodeURIComponent(input.taskId)}`, { headers: { Authorization: authorization } });
    }
    const images = collectImages(request.input);
    if (!images.length) throw new Error("星图视频接口没有收到有效的真人穿搭图");
    const firstFrame = images[0];
    const lookCount = input.lookCount || images.length;
    const templatePrompt = input.videoTemplate?.prompt ? `\n\n视频模板要求：${input.videoTemplate.prompt}` : "";
    const referenceHint = images.length > 1 ? `\n\n本次提供 ${images.length} 张参考图，按模板要求换装 ${lookCount} 套，人物形象以第 1 张为准，顺序 1→2→...→${lookCount}→1。` : "";
    return fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({
        model: target.model || "MiniMax-Hailuo-2.3",
        input: { first_frame_image: firstFrame, prompt: `${prompt}${referenceHint}${templatePrompt}`, reference_video: input.videoTemplate?.referenceVideo },
        parameters: { duration: 10, resolution: "768P", prompt_optimizer: true, fast_pretreatment: false, aigc_watermark: false },
      }),
    });
  }

  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(target.token ? { Authorization: `Bearer ${target.token}` } : {}) },
    body: JSON.stringify({ task_id: taskId, parent_task_id: request.parentTaskId, agent_id: agentId, prompt, input: request.input, parameters: request.parameters || {}, metadata: request.metadata || {} }),
  });
}

export async function runAgent(agentId: AgentId, request: AgentRunRequest, retryLimit = 2): Promise<AgentRunResult> {
  const started = Date.now();
  const target = {
    url: request.connection?.url || config[agentId]?.url,
    token: request.connection?.token || config[agentId]?.token,
    model: request.connection?.model,
  };
  const taskId = request.taskId || createTaskId(agentId);
  const agent = agentId === "orchestrator" ? orchestrator : agents.find((item) => item.id === agentId);

  if (!target?.url || !agent) {
    return {
      taskId,
      agentId,
      status: "failed",
      error: `智能体 ${agentId} 尚未配置 API 地址`,
      durationMs: Date.now() - started,
      attempts: 0,
    };
  }

  let lastError = "未知错误";
  for (let attempt = 1; attempt <= retryLimit + 1; attempt += 1) {
    try {
      const response = await postAgent(agentId, target as { url: string; token?: string; model?: string }, request, taskId, request.prompt || agent.prompt);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.startsWith("image/")) {
        const data = Buffer.from(await response.arrayBuffer()).toString("base64");
        return { taskId, agentId, status: "succeeded", output: { image: `data:${contentType.split(";")[0]};base64,${data}` }, durationMs: Date.now() - started, attempts: attempt };
      }
      if (contentType.includes("text/html")) throw new Error("当前 API 地址返回的是网页 HTML，不是模型接口。请填写该平台文档中的完整 POST 接口地址。");
      const responseText = await response.text();
      let body: Record<string, any>;
      try { body = JSON.parse(responseText); } catch { body = { message: responseText }; }
      if (!response.ok) {
        if (response.status === 405) throw new Error("API 地址拒绝 POST 请求（HTTP 405）。请填写该平台具体的生成接口地址，而不是平台官网或 API 基础地址。");
        if (response.status === 401 || response.status === 403) throw new Error(`API 鉴权失败（HTTP ${response.status}），请检查 API Key 和授权方式。`);
        throw new Error(readableError(body.error || body.message || `智能体接口返回 HTTP ${response.status}`));
      }

      const deepSeekOutput = isDeepSeek(target.url) ? parseJsonContent(body.choices?.[0]?.message?.content) : undefined;
      const modelVerseImages = (isModelVerse(target.url) || isArk(target.url)) && Array.isArray(body.data)
        ? body.data.map((item: Record<string, unknown>) => typeof item.b64_json === "string" ? (item.b64_json.startsWith("data:") ? item.b64_json : `data:image/png;base64,${item.b64_json}`) : item.url).filter(Boolean)
        : undefined;
      const videoTask = agentId === "snap-change-video" && (isModelVerse(target.url) || isArk(target.url)) ? body.output : undefined;
      if (videoTask?.task_status === "Failure") throw new Error(videoTask.error_message || "星图视频任务生成失败");
      const videoStatus = videoTask?.task_status === "Pending" || videoTask?.task_status === "Running" || (videoTask?.task_id && !videoTask?.task_status) ? "processing" : videoTask?.task_status === "Success" ? "succeeded" : undefined;
      const videoOutput = videoTask?.task_status === "Success" ? { video: videoTask.urls?.[0], urls: videoTask.urls } : videoTask;

      return {
        taskId,
        agentId,
        status: videoStatus || body.status || "succeeded",
        output: videoOutput ?? deepSeekOutput ?? (modelVerseImages?.length ? { images: modelVerseImages } : undefined) ?? body.output ?? body.data ?? body,
        externalTaskId: videoTask?.task_id || body.task_id || body.external_task_id,
        durationMs: Date.now() - started,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt <= retryLimit) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  return { taskId, agentId, status: "failed", error: lastError, durationMs: Date.now() - started, attempts: retryLimit + 1 };
}
