"use client";

import { useEffect, useState } from "react";

type StageState = "waiting" | "running" | "done" | "failed";
type StageMap = Record<"parent" | "white" | "hollow" | "video", StageState>;
type Connection = { url?: string; token?: string };
type AgentResult = { status?: string; output?: unknown; error?: string; taskId?: string; externalTaskId?: string };

const requiredAgents = [
  ["orchestrator", "流程决策服务"], ["product-white-bg", "商品净图"],
  ["hollow-look", "穿搭陈列"], ["snap-change-video", "动态商拍"],
] as const;
const initialStages: StageMap = { parent: "waiting", white: "waiting", hollow: "waiting", video: "waiting" };

const defaultVideoTemplates = [
  { id: "snap-loop", code: "A", name: "响指循环变装", description: "固定正面机位，右手响指触发丝滑换装，结尾回到开场造型。", preview: "/references/reference.mp4", prompt: "采用模板 A：固定正面中景，人物每次用右手打响指后触发连续布料重构，六次变装，结尾回到首套造型形成无缝循环。" },
  { id: "studio-turn", code: "B", name: "转身棚拍切换", description: "轻微转身与整理衣摆，在动作遮挡中自然完成造型切换。", cover: "/references/look-04.jpeg", prompt: "采用模板 B：高级摄影棚固定中景，人物以轻微左右转身、抬手整理衣摆和包袋为动作衔接，在身体自然运动的遮挡阶段连续完成服装演化；节奏舒缓、优雅，不使用闪切。" },
  { id: "runway-step", code: "C", name: "走秀步点变装", description: "小幅向前走动，每个步点完成一次完整造型演化。", cover: "/references/look-03.jpeg", prompt: "采用模板 C：人物始终位于画面中心，在摄影棚内进行克制的小幅向前走秀；每个清晰步点触发一次全身服装连续重构，镜头保持稳定，动作与服装演化节拍严格同步。" },
] as const;
type VideoTemplate = { id: string; code: string; name: string; description: string; prompt: string; preview?: string; previewUrl?: string; cover?: string };

function collectAssetUrls(value: unknown, found = new Set<string>()): string[] {
  if (typeof value === "string" && (/^(https?:|data:image|data:video)/.test(value))) found.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectAssetUrls(item, found));
  else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((item) => collectAssetUrls(item, found));
  return [...found];
}

function StageResults({ title, results, onPreview }: { title: string; results: AgentResult[]; onPreview: (url: string) => void }) {
  if (!results.length) return null;
  return <div className="stage-results"><div className="result-title"><b>{title}</b><span>{results.length} 个结果</span></div><div className="result-grid">{results.map((result, index) => {
    const urls = collectAssetUrls(result.output);
    return <article className="result-card" key={`${title}-${index}`}><header><span>{String(index + 1).padStart(2, "0")}</span><b>{result.status === "processing" ? "任务处理中" : "生成成功"}</b></header>
      {urls.length ? <div className="media-grid">{urls.map((url) => /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video") ? <video key={url} src={url} controls playsInline/> : <div className="zoomable-image" key={url}><img src={url} alt={`${title} ${index + 1}`}/><button type="button" onClick={() => onPreview(url)} aria-label="放大查看图片">⛶</button></div>)}</div> : <pre>{JSON.stringify(result.output, null, 2)}</pre>}
      {result.externalTaskId && <small>外部任务：{result.externalTaskId}</small>}
    </article>;
  })}</div></div>;
}

export function TestWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [retryLimit, setRetryLimit] = useState("2");
  const [videoTemplates, setVideoTemplates] = useState<VideoTemplate[]>([...defaultVideoTemplates]);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultVideoTemplates[0].id);
  const [stages, setStages] = useState<StageMap>(initialStages);
  const [configured, setConfigured] = useState<string[]>([]);
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string>();
  const [previewImage, setPreviewImage] = useState<string>();
  const [results, setResults] = useState<Record<string, AgentResult[]>>({ parent: [], white: [], hollow: [], video: [] });

  useEffect(() => {
    const refreshConnections = () => {
      const saved = JSON.parse(window.localStorage.getItem("lumera-connections") || window.localStorage.getItem("snapflow-connections") || "{}");
      setConnections(saved);
      fetch("/api/agents/status").then(response => response.json()).then(data => {
        const serverIds = (data.agents || []).filter((item: {connected:boolean}) => item.connected).map((item: {id:string}) => item.id);
        setConfigured(requiredAgents.filter(([id]) => Boolean(saved[id]?.url) || serverIds.includes(id)).map(([id]) => id));
      }).catch(() => setConfigured(requiredAgents.filter(([id]) => Boolean(saved[id]?.url)).map(([id]) => id)));
    };
    refreshConnections();
    window.addEventListener("snapflow-connections-updated", refreshConnections);
    return () => window.removeEventListener("snapflow-connections-updated", refreshConnections);
  }, []);
  useEffect(() => {
    fetch("/api/video-templates").then(response => response.ok ? response.json() : Promise.reject()).then(data => {
      const cloud = (data.templates || []).filter((item: {enabled:boolean}) => item.enabled);
      if (cloud.length) { setVideoTemplates(cloud); setSelectedTemplate(cloud[0].id); }
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file)); setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  async function asDataUrl(file: File) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理这张图片");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片压缩失败")), "image/jpeg", .86));
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  }
  function removeFile(index: number) { setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function setStage(stage: keyof StageMap, state: StageState) { setStages((current) => ({ ...current, [stage]: state })); }
  function updateConnection(id: string, field: "url" | "token", value: string) {
    setConnections((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }
  function saveConnections() {
    window.localStorage.setItem("snapflow-connections", JSON.stringify(connections));
    setConfigured(requiredAgents.filter(([id]) => Boolean(connections[id]?.url)).map(([id]) => id));
    setConnectionSaved(true); window.setTimeout(() => setConnectionSaved(false), 1600);
  }

  async function callAgent(agentId: string, input: unknown, connection?: Connection, parentTaskId?: string): Promise<AgentResult> {
    let response: Response;
    try {
      response = await fetch(`/api/agents/${agentId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, connection, parentTaskId, retryLimit: Number(retryLimit) }) });
    } catch {
      throw new Error(`${requiredAgents.find(([id]) => id === agentId)?.[1] || agentId}：请求未能发送。图片可能过大、接口地址不可访问，或第三方服务暂时断开。`);
    }
    const result = await response.json().catch(() => ({ error: `服务器返回 HTTP ${response.status}` }));
    if (!response.ok || result.status === "failed") {
      const detail = typeof result.error === "string" ? result.error : JSON.stringify(result.error || result);
      throw new Error(`${requiredAgents.find(([id]) => id === agentId)?.[1] || agentId}：${detail || `调用失败（HTTP ${response.status}）`}`);
    }
    return result;
  }

  function activeConnections() {
    return embedded ? JSON.parse(window.localStorage.getItem("lumera-connections") || window.localStorage.getItem("snapflow-connections") || "{}") as Record<string, Connection> : connections;
  }

  async function runWhiteStage() {
    setMessage(""); setStages(initialStages); setResults({ parent: [], white: [], hollow: [], video: [] });
    setParentTaskId(undefined);
    const active = activeConnections();
    const missing = ["orchestrator", "product-white-bg"].filter((id) => !configured.includes(id) && !active[id]?.url).map((id) => requiredAgents.find(([agentId]) => agentId === id)?.[1]);
    if (missing.length) return setMessage(`第一步还缺少 API：${missing.join("、")}`);
    if (!files.length) return setMessage("请先点击上传区域，选择至少一张商品图片");
    setRunning(true); let activeStage: keyof StageMap = "parent";
    try {
      const images = await Promise.all(files.map(asDataUrl));
      setStage("parent", "running");
      const plan = await callAgent("orchestrator", { phase: "plan", looks: images.map((_, index) => ({ id: `look-${index + 1}`, productImageCount: 1 })) }, active.orchestrator);
      const taskId = plan.taskId; setParentTaskId(taskId); setResults((current) => ({ ...current, parent: [plan] })); setStage("parent", "done");
      activeStage = "white"; setStage("white", "running");
      const white = await Promise.all(images.map((image, index) => callAgent("product-white-bg", { image, lookId: `look-${index + 1}`, productIndex: 0 }, active["product-white-bg"], taskId)));
      setResults((current) => ({ ...current, white })); setStage("white", "done");
      setMessage("已完成第一步。请检查白底图，满意后点击“下一步：生成镂空图”。");
    } catch (error) { setStage(activeStage, "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  async function runHollowStage() {
    if (stages.white !== "done" || !results.white.length) return setMessage("请先完成并确认白底图。");
    const active = activeConnections();
    if (!configured.includes("hollow-look") && !active["hollow-look"]?.url) return setMessage("第二步还缺少穿搭陈列服务。");
    setMessage(""); setRunning(true); setStage("hollow", "running");
    try {
      const hollow: AgentResult[] = [];
      for (let index = 0; index < results.white.length; index += 1) hollow.push(await callAgent("hollow-look", { lookId: `look-${index + 1}`, products: [results.white[index].output] }, active["hollow-look"], parentTaskId));
      setResults((current) => ({ ...current, hollow })); setStage("hollow", "done");
      setMessage("已完成第二步。请检查穿搭陈列图，满意后点击“下一步：生成动态视频”。");
    } catch (error) { setStage("hollow", "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  async function runVideoStage() {
    if (stages.hollow !== "done" || !results.hollow.length) return setMessage("请先完成并确认镂空图。");
    const active = activeConnections();
    if (!configured.includes("snap-change-video") && !active["snap-change-video"]?.url) return setMessage("第三步还缺少动态商拍服务。");
    setMessage(""); setRunning(true); setStage("video", "running");
    try {
      const template = videoTemplates.find(item => item.id === selectedTemplate) || videoTemplates[0];
      let video = await callAgent("snap-change-video", { looks: results.hollow.map((item) => item.output), videoTemplate: { id: template.id, name: template.name, prompt: template.prompt, referenceVideo: template.previewUrl || template.preview }, parameters: { duration: 10, aspectRatio: "9:16", fps: 30 } }, active["snap-change-video"], parentTaskId);
      if (video.status === "processing" && video.externalTaskId) {
        setMessage("视频任务已提交，正在等待星图生成，请勿关闭页面……");
        for (let attempt = 0; attempt < 60 && video.status === "processing"; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          video = await callAgent("snap-change-video", { phase: "poll", taskId: video.externalTaskId }, active["snap-change-video"], parentTaskId);
        }
      }
      if (video.status === "processing") throw new Error("星图视频生成等待超时，请稍后重试或前往星图模型日志查看任务。");
      setResults((current) => ({ ...current, video: [video] })); setStage("video", "done");
      setMessage("已完成第三步，动态商拍视频已生成并保留在结果区。");
    } catch (error) { setStage("video", "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  const statusText = (state: StageState) => ({ waiting: "等待", running: "处理中", done: "✓ 通过", failed: "✕ 失败" })[state];
  return <div className={`test-shell ${embedded ? "embedded-test-shell" : ""}`}>{!embedded && <header className="test-head"><div><span className="kicker">UNIFIED WORKSPACE</span><h1>API 配置与流水线测试台</h1><p>在一个页面完成接口接入、素材上传、分阶段生成与结果验收。</p></div><a className="back" href="/">← 返回调度中心</a></header>}
    {!embedded && <section className="inline-api"><div className="inline-api-head"><div><span className="kicker">01 · API CONNECTIONS</span><h2>智能体接口接入</h2><p>配置保存在当前浏览器，保存后可直接在下方运行。</p></div><button className="primary" onClick={saveConnections}>{connectionSaved ? "已保存 ✓" : "保存全部 API"}</button></div>
      <div className="api-grid compact-api-grid">{requiredAgents.map(([id, name], index) => { const colors = ["#ffcf58", "#ff8a4c", "#8a6cff", "#31c7a2"]; const ready = Boolean(connections[id]?.url); const placeholder = id === "orchestrator" ? "https://api.deepseek.com/chat/completions" : id === "product-white-bg" ? "https://api.remove.bg/v1.0/removebg" : id === "hollow-look" ? "https://api.modelverse.cn/v1/images/generations" : "https://api.modelverse.cn/v1/tasks/submit"; return <article key={id} style={{"--accent":colors[index]} as React.CSSProperties}><div className="api-card-head"><span>{index === 0 ? "P" : `0${index}`}</span><b className={ready ? "connected" : "disconnected"}>{ready ? "● 已填写" : "○ 待配置"}</b></div><h3>{name}</h3><label className="api-field"><span>API 地址</span><input type="url" placeholder={placeholder} value={connections[id]?.url || ""} onChange={(event) => updateConnection(id, "url", event.target.value)}/></label><label className="api-field"><span>API Key</span><input type="password" placeholder="粘贴 API Key" value={connections[id]?.token || ""} onChange={(event) => updateConnection(id, "token", event.target.value)}/></label></article>})}</div>
    </section>}
    <section className="tester staged-tester"><div className="test-panel task-creator"><span className="workspace-step">NEW PROJECT</span><h2>上传商品素材</h2>
      <input id="product-images" className="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []))}/><label className="dropzone upload-zone" htmlFor="product-images"><span className="upload-icon">＋</span><b>点击上传商品图片</b><p>支持 JPG、PNG、WebP，可一次选择多张</p><span className="upload-action">选择图片</span></label>
      {files.length > 0 && <div className="upload-list">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}`}><img src={previews[index]} alt={file.name}/><div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div><button type="button" disabled={running} onClick={() => removeFile(index)} aria-label={`移除 ${file.name}`}>×</button></article>)}</div>}
      <div className="connection-check"><b>生产服务状态</b><span>{configured.length}/4 已就绪</span>{configured.length < 4 && <a href="/admin">联系管理员配置 ↗</a>}</div>
      <div className="formrow"><div className="field"><label>造型套数</label><input value={`${Math.max(files.length, 1)} 套`} readOnly/></div><div className="field"><label>失败重试</label><select value={retryLimit} disabled={running} onChange={(event) => setRetryLimit(event.target.value)}><option value="2">2 次</option><option value="1">1 次</option><option value="0">不重试</option></select></div></div>
      <div className="template-picker"><header><div><span>VIDEO TEMPLATE</span><b>选择动态视频模板</b></div><small>已选择 {videoTemplates.find(item => item.id === selectedTemplate)?.code}</small></header><div className="template-grid">{videoTemplates.map(template => <button type="button" key={template.id} className={selectedTemplate === template.id ? "selected" : ""} onClick={() => setSelectedTemplate(template.id)} disabled={running}>{template.previewUrl || template.preview ? <video src={template.previewUrl || template.preview} muted playsInline loop autoPlay/> : <img src={template.cover || "/references/look-03.jpeg"} alt=""/>}<span className="template-code">{template.code}</span><div><b>{template.name}</b><p>{template.description}</p></div><i>{selectedTemplate === template.id ? "✓" : ""}</i></button>)}</div></div>
      <div className="manual-stage-actions"><button className="primary full" onClick={runWhiteStage} disabled={running}>{stages.white === "done" ? "重新生成商品净图" : "第一步 · 生成商品净图"}</button><button className="primary full" onClick={runHollowStage} disabled={running || stages.white !== "done"}>{stages.hollow === "done" ? "重新生成穿搭陈列" : "下一步 · 生成穿搭陈列"}</button><button className="primary full" onClick={runVideoStage} disabled={running || stages.hollow !== "done"}>{stages.video === "done" ? "重新生成动态视频" : "下一步 · 生成动态商拍"}</button></div>{message && <div className={`test-message ${message.startsWith("已完成") ? "success" : "error"}`}>{message}</div>}
    </div><div className="test-panel result-workspace"><span className="workspace-step">PROJECT OUTPUT</span><h2>素材生成进度</h2><div className="tree">
      <div className={`tree-node parent ${stages.parent}`}><span className="num">◆</span><div><b>项目准备</b><small>素材检查与生成计划</small></div><span>{statusText(stages.parent)}</span></div><div className="tree-line"/>
      <div className={`tree-node ${stages.white}`}><span className="num">01</span><div><b>商品净图</b><small>完成后展示标准白底商品图</small></div><span>{statusText(stages.white)}</span></div><StageResults title="商品净图结果" results={results.white} onPreview={setPreviewImage}/><div className="tree-line"/>
      <div className={`tree-node ${stages.hollow}`}><span className="num">02</span><div><b>穿搭陈列</b><small>展示完整隐形人台穿搭结果</small></div><span>{statusText(stages.hollow)}</span></div><StageResults title="穿搭陈列结果" results={results.hollow} onPreview={setPreviewImage}/><div className="tree-line"/>
      <div className={`tree-node ${stages.video}`}><span className="num">03</span><div><b>动态商拍</b><small>展示最终 10 秒竖版视频</small></div><span>{statusText(stages.video)}</span></div><StageResults title="动态商拍视频" results={results.video} onPreview={setPreviewImage}/>
    </div></div></section>{previewImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="图片细节预览" onClick={() => setPreviewImage(undefined)}><button type="button" onClick={() => setPreviewImage(undefined)} aria-label="关闭预览">×</button><img src={previewImage} alt="放大后的生成结果" onClick={(event) => event.stopPropagation()}/></div>}</div>;
}

export default function TestPage() {
  useEffect(() => { window.location.replace("/#workspace"); }, []);
  return null;
}
