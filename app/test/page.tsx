"use client";

import { useEffect, useState } from "react";
import { loadPlans, defaultSubscription, type SubscriptionPlan, type Subscription } from "../../lib/plans";

type StageState = "waiting" | "running" | "done" | "failed";
type StudioView = "setup" | "white" | "hollow" | "video";
type StageMap = Record<"parent" | "white" | "hollow" | "video", StageState>;
type Connection = { url?: string; token?: string; model?: string };
type AgentResult = { status?: string; output?: unknown; error?: string; taskId?: string; externalTaskId?: string; lookId?: string; category?: string };

const requiredAgents = [
  ["orchestrator", "流程决策服务"], ["product-white-bg", "商品净图"],
  ["hollow-look", "真人穿搭"], ["snap-change-video", "动态商拍"],
] as const;
const initialStages: StageMap = { parent: "waiting", white: "waiting", hollow: "waiting", video: "waiting" };
const garmentCategories = ["上衣", "外套", "下装", "连衣裙", "鞋履", "包袋", "帽子", "眼镜", "配饰"];
const modelDefaults: Record<string, string> = { orchestrator: "deepseek-v4-pro", "hollow-look": "Qwen/Qwen-Image-Edit", "snap-change-video": "MiniMax-Hailuo-2.3" };

const defaultVideoTemplates = [
  { id: "snap-loop", code: "A", name: "响指循环变装", description: "固定正面机位，右手响指触发丝滑换装，结尾回到开场造型。", preview: "/references/reference.mp4", prompt: "采用模板 A：固定正面中景，人物每次用右手打响指后触发连续布料重构，六次变装，结尾回到首套造型形成无缝循环。" },
  { id: "studio-turn", code: "B", name: "转身棚拍切换", description: "轻微转身与整理衣摆，在动作遮挡中自然完成造型切换。", cover: "/references/look-04.jpeg", prompt: "采用模板 B：高级摄影棚固定中景，人物以轻微左右转身、抬手整理衣摆和包袋为动作衔接，在身体自然运动的遮挡阶段连续完成服装演化；节奏舒缓、优雅，不使用闪切。" },
  { id: "runway-step", code: "C", name: "走秀步点变装", description: "小幅向前走动，每个步点完成一次完整造型演化。", cover: "/references/look-03.jpeg", prompt: "采用模板 C：人物始终位于画面中心，在摄影棚内进行克制的小幅向前走秀；每个清晰步点触发一次全身服装连续重构，镜头保持稳定，动作与服装演化节拍严格同步。" },
] as const;
type VideoTemplate = { id: string; code: string; name: string; description: string; prompt: string; lookCount: number; preview?: string; previewUrl?: string; cover?: string };

function collectAssetUrls(value: unknown, found = new Set<string>()): string[] {
  if (typeof value === "string" && (/^(https?:|data:image|data:video)/.test(value))) found.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectAssetUrls(item, found));
  else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((item) => collectAssetUrls(item, found));
  return [...found];
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("商品图加载失败，无法拼接"));
    image.src = src;
  });
}

// 把多件白底单品拼成一张带类别标签的网格图，供单图编辑模型使用。单件时直接返回原图。
async function composeContactSheet(items: Array<{ category: string; url: string }>): Promise<string> {
  if (items.length <= 1) return items[0]?.url || "";
  const cols = items.length <= 2 ? 1 : 2;
  const rows = Math.ceil(items.length / cols);
  const cellW = 1024;
  const cellH = 1536;
  const labelSpace = 180;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建拼接画布");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < items.length; index += 1) {
    const image = await loadImageElement(items[index].url);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const scale = Math.min((cellW - 120) / image.width, (cellH - labelSpace - 80) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = col * cellW + (cellW - width) / 2;
    const y = row * cellH + labelSpace + (cellH - labelSpace - 80 - height) / 2;
    context.drawImage(image, x, y, width, height);
    context.fillStyle = "#101010";
    context.font = "bold 72px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(items[index].category || `商品 ${index + 1}`, col * cellW + cellW / 2, row * cellH + labelSpace / 2);
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

function StageResults({ title, results, onPreview }: { title: string; results: AgentResult[]; onPreview: (url: string) => void }) {
  if (!results.length) return null;
  return <div className="stage-results"><div className="result-title"><b>{title}</b><span>{results.length} 个结果</span></div><div className="result-grid">{results.map((result, index) => {
    const urls = collectAssetUrls(result.output);
    return <article className="result-card" key={`${title}-${index}`}><header><span>{String(index + 1).padStart(2, "0")}</span><b>{result.status === "processing" ? "任务处理中" : "生成成功"}</b></header>
      {urls.length ? <div className="media-grid">{urls.map((url, urlIndex) => {
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video");
        const ext = isVideo ? "mp4" : "png";
        return <div className="media-item" key={url}>{isVideo ? <video src={url} controls playsInline/> : <div className="zoomable-image"><img src={url} alt={`${title} ${index + 1}`}/><button type="button" onClick={() => onPreview(url)} aria-label="放大查看图片">⛶</button></div>}<a className="download-button" href={url} download={`${title}-${index + 1}-${urlIndex + 1}.${ext}`} aria-label="下载">↓ 下载</a></div>;
      })}</div> : <pre>{JSON.stringify(result.output, null, 2)}</pre>}
      {result.externalTaskId && <small>外部任务：{result.externalTaskId}</small>}
    </article>;
  })}</div></div>;
}

export function TestWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileMeta, setFileMeta] = useState<Array<{ lookId: string; category: string }>>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [outfitCount, setOutfitCount] = useState(1);
  const [personFile, setPersonFile] = useState<File>();
  const [personPreview, setPersonPreview] = useState("");
  const [hollowUploads, setHollowUploads] = useState<File[]>([]);
  const [hollowUploadPreviews, setHollowUploadPreviews] = useState<string[]>([]);
  const [videoUploads, setVideoUploads] = useState<File[]>([]);
  const [videoUploadPreviews, setVideoUploadPreviews] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [retryLimit, setRetryLimit] = useState("2");
  const [videoTemplates, setVideoTemplates] = useState<VideoTemplate[]>([...defaultVideoTemplates]);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultVideoTemplates[0].id);
  const [stages, setStages] = useState<StageMap>(initialStages);
  const [studioView, setStudioView] = useState<StudioView>("setup");
  const [configured, setConfigured] = useState<string[]>([]);
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [subscription, setSubscription] = useState<Subscription>(defaultSubscription());
  const [showSubscription, setShowSubscription] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string>();
  const [previewImage, setPreviewImage] = useState<string>();
  const [results, setResults] = useState<Record<string, AgentResult[]>>({ parent: [], white: [], hollow: [], video: [] });

  useEffect(() => {
    const refreshConnections = () => {
      const saved = JSON.parse(window.localStorage.getItem("lumera-connections") || window.localStorage.getItem("snapflow-connections") || "{}");
      const savedPrompts = JSON.parse(window.localStorage.getItem("lumera-prompts") || window.localStorage.getItem("snapflow-prompts") || "{}");
      setConnections(saved);
      setCustomPrompts(savedPrompts);
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
    fetch("/api/prompt-videos").then(response => response.ok ? response.json() : Promise.reject()).then(data => {
      const videos = (data.videos || []).filter((item: {enabled:boolean}) => item.enabled);
      if (videos.length) {
        const templates = videos.map((video: { id: string; code?: string; title: string; description: string; prompt: string; lookCount?: number; videoUrl?: string; posterUrl?: string }) => ({
          id: video.id, code: video.code || "NEW", name: video.title, description: video.description, prompt: video.prompt, lookCount: video.lookCount || 5, previewUrl: video.videoUrl, cover: video.posterUrl,
        }));
        setVideoTemplates(templates); setSelectedTemplate(templates[0].id);
      }
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file)); setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => { if (!personFile) return setPersonPreview(""); const url = URL.createObjectURL(personFile); setPersonPreview(url); return () => URL.revokeObjectURL(url); }, [personFile]);
  useEffect(() => { const urls = hollowUploads.map((file) => URL.createObjectURL(file)); setHollowUploadPreviews(urls); return () => urls.forEach((url) => URL.revokeObjectURL(url)); }, [hollowUploads]);
  useEffect(() => { const urls = videoUploads.map((file) => file ? URL.createObjectURL(file) : ""); setVideoUploadPreviews(urls); return () => urls.forEach((url) => url && URL.revokeObjectURL(url)); }, [videoUploads]);

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
  function removeFile(index: number) { setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); setFileMeta((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function setStage(stage: keyof StageMap, state: StageState) { setStages((current) => ({ ...current, [stage]: state })); }
  function updateConnection(id: string, field: "url" | "token" | "model", value: string) {
    setConnections((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }
  function setVideoSlot(index: number, file: File | undefined) {
    setVideoUploads((current) => { const next = [...current]; next[index] = file; return next; });
  }
  async function saveHistory(result: AgentResult, stage: string, stageName: string) {
    const urls = collectAssetUrls(result.output);
    for (const url of urls) {
      const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video");
      try {
        await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: isVideo ? "video" : "image", stage, stageName, url }) });
      } catch {
        // 保存失败不影响主流程
      }
    }
  }
  function saveConnections() {
    window.localStorage.setItem("snapflow-connections", JSON.stringify(connections));
    setConfigured(requiredAgents.filter(([id]) => Boolean(connections[id]?.url)).map(([id]) => id));
    setConnectionSaved(true); window.setTimeout(() => setConnectionSaved(false), 1600);
  }
  function getSubscription(): Subscription {
    try {
      const saved = JSON.parse(window.localStorage.getItem("lumera-subscription") || "null");
      if (saved && typeof saved.videoQuota === "number") return saved;
    } catch { /* ignore */ }
    return defaultSubscription();
  }
  function quotaKey(stage: string): keyof Subscription {
    return stage === "product-white-bg" ? "whiteQuota" : stage === "hollow-look" ? "hollowQuota" : "videoQuota";
  }
  function hasQuota(stage: string): boolean {
    const current = getSubscription();
    const value = current[quotaKey(stage)];
    return value === -1 || value > 0;
  }
  function subscribe(plan: SubscriptionPlan) {
    if (plan.id === "free") { setShowSubscription(false); return; }
    const next: Subscription = { plan: plan.id, whiteQuota: plan.whiteQuota, hollowQuota: plan.hollowQuota, videoQuota: plan.videoQuota };
    window.localStorage.setItem("lumera-subscription", JSON.stringify(next));
    setSubscription(next);
    setShowSubscription(false);
    setMessage(`已订阅${plan.name}，白底图与真人穿搭不限次数，视频额度 ${plan.videoQuota} 次`);
  }
  function consumeQuota(stage: string) {
    const current = getSubscription();
    const key = quotaKey(stage);
    if ((current[key] as number) > 0) current[key] = (current[key] as number) - 1;
    window.localStorage.setItem("lumera-subscription", JSON.stringify(current));
    setSubscription(current);
  }

  async function callAgent(agentId: string, input: unknown, connection?: Connection, parentTaskId?: string): Promise<AgentResult> {
    let response: Response;
    try {
      response = await fetch(`/api/agents/${agentId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, connection, parentTaskId, retryLimit: Number(retryLimit), prompt: customPrompts[agentId] }) });
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
    if (!embedded) return connections;
    return JSON.parse(window.localStorage.getItem("lumera-connections") || window.localStorage.getItem("snapflow-connections") || "{}") as Record<string, Connection>;
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
      const looks = Array.from({length:outfitCount},(_,index)=>({id:`look-${index+1}`,productImageCount:fileMeta.filter(item=>item.lookId===`look-${index+1}`).length})).filter(item=>item.productImageCount>0);
      const plan = await callAgent("orchestrator", { phase: "plan", looks, hasIdentityReference:Boolean(personFile) }, active.orchestrator);
      const taskId = plan.taskId; setParentTaskId(taskId); setResults((current) => ({ ...current, parent: [plan] })); setStage("parent", "done");
      activeStage = "white"; setStage("white", "running");
      const white = await Promise.all(images.map(async (image, index) => ({...(await callAgent("product-white-bg", { image, lookId: fileMeta[index]?.lookId || "look-1", category:fileMeta[index]?.category || "上衣", productIndex: index }, active["product-white-bg"], taskId)),lookId:fileMeta[index]?.lookId || "look-1",category:fileMeta[index]?.category || "上衣"})));
      setResults((current) => ({ ...current, white })); setStage("white", "done"); white.forEach((r) => saveHistory(r, "product-white-bg", "商品净图"));
      setStudioView("white");
      setMessage("已完成第一步。请检查白底图，满意后点击“下一步：生成真人穿搭”。");
    } catch (error) { setStage(activeStage, "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  async function runHollowStage() {
    if (!personFile) return setMessage("请先上传一张正面全身人物基准图。");
    const active = activeConnections();
    if (!configured.includes("hollow-look") && !active["hollow-look"]?.url) return setMessage("真人穿搭服务未配置，请到运营后台接入。");
    setMessage(""); setRunning(true); setStage("hollow", "running");
    try {
      const personImage = await asDataUrl(personFile);
      const hollow: AgentResult[] = [];
      if (hollowUploads.length) {
        const uploaded = await Promise.all(hollowUploads.map(asDataUrl));
        const items = uploaded.map((url, index) => ({ category: `商品${index + 1}`, url }));
        const sheet = await composeContactSheet([{ category: "人物基准", url: personImage }, ...items]);
        hollow.push({ ...await callAgent("hollow-look", { lookId: "look-1", image: sheet, categories: items.map(item => item.category), productCount: items.length, identityReference: personImage }, active["hollow-look"], parentTaskId), lookId: "look-1" });
      } else {
        for (let index = 0; index < outfitCount; index += 1) {
          const lookId = `look-${index + 1}`;
          const products = results.white.filter(item => item.lookId === lookId).map(item => ({ category: item.category || "单品", asset: item.output }));
          if (!products.length) continue;
          const items = products
            .map((product, productIndex) => ({ category: product.category || `商品${productIndex + 1}`, url: collectAssetUrls(product.asset)[0] }))
            .filter((item): item is { category: string; url: string } => Boolean(item.url));
          if (!items.length) throw new Error(`造型 ${index + 1} 没有可用的白底图，无法生成真人穿搭`);
          const sheet = await composeContactSheet([{ category: "人物基准", url: personImage }, ...items]);
          hollow.push({ ...await callAgent("hollow-look", { lookId, image: sheet, categories: items.map(item => item.category), productCount: items.length, identityReference: personImage }, active["hollow-look"], parentTaskId), lookId });
        }
      }
      if (!hollow.length) throw new Error("没有可用的白底图，请先完成商品净图，或在本步骤上传已有白底图");
      setResults((current) => ({ ...current, hollow })); setStage("hollow", "done"); hollow.forEach((r) => saveHistory(r, "hollow-look", "真人穿搭"));
      setStudioView("hollow");
      setMessage("已完成真人穿搭。请检查人物身份和服装，满意后点击“下一步：生成动态视频”。");
    } catch (error) { setStage("hollow", "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  async function runVideoStage() {
    const active = activeConnections();
    if (!configured.includes("snap-change-video") && !active["snap-change-video"]?.url) return setMessage("动态商拍服务未配置，请到运营后台接入。");
    const template = videoTemplates.find(item => item.id === selectedTemplate) || videoTemplates[0];
    const lookCount = template.lookCount || 5;
    setMessage(""); setRunning(true); setStage("video", "running");
    try {
      let looks: unknown[];
      const uploaded = videoUploads.filter(Boolean) as File[];
      if (uploaded.length) {
        looks = await Promise.all(uploaded.map(asDataUrl));
      } else {
        if (!results.hollow.length) throw new Error("没有可用的真人穿搭图，请先完成真人穿搭，或上传穿搭图");
        looks = results.hollow.map((item) => item.output);
      }
      let video = await callAgent("snap-change-video", { looks, videoTemplate: { id: template.id, name: template.name, prompt: template.prompt, referenceVideo: template.previewUrl || template.preview }, parameters: { duration: 10, aspectRatio: "9:16", fps: 30 } }, active["snap-change-video"], parentTaskId);
      if (video.status === "processing" && video.externalTaskId) {
        setMessage("视频任务已提交，正在等待星图生成，请勿关闭页面……");
        for (let attempt = 0; attempt < 60 && video.status === "processing"; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          video = await callAgent("snap-change-video", { phase: "poll", taskId: video.externalTaskId }, active["snap-change-video"], parentTaskId);
        }
      }
      if (video.status === "processing") throw new Error("星图视频生成等待超时，请稍后重试或前往星图模型日志查看任务。");
      setResults((current) => ({ ...current, video: [video] })); setStage("video", "done"); saveHistory(video, "snap-change-video", "动态商拍");
      setStudioView("video");
      setMessage("已完成第三步，动态商拍视频已生成并保留在结果区。");
    } catch (error) { setStage("video", "failed"); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  }

  const statusText = (state: StageState) => ({ waiting: "等待", running: "处理中", done: "✓ 通过", failed: "✕ 失败" })[state];
  if (embedded) {
    const steps: Array<{id:StudioView; number:string; name:string; note:string; unlocked:boolean; done:boolean}> = [
      {id:"setup",number:"01",name:"人物与造型",note:"上传人物与商品并完成分组",unlocked:true,done:stages.white==="done"},
      {id:"white",number:"02",name:"商品净图",note:"上传商品图或检查白底结果",unlocked:true,done:stages.hollow==="done"},
      {id:"hollow",number:"03",name:"真人穿搭",note:"上传白底图或使用上一步结果",unlocked:true,done:stages.video==="done"},
      {id:"video",number:"04",name:"动态视频",note:"上传穿搭图或使用上一步结果",unlocked:true,done:stages.video==="done"},
    ];
    const current = steps.find(item=>item.id===studioView) || steps[0];
    const outfitFiles = (lookIndex:number) => files.map((file,index)=>({file,index})).filter(({index})=>(fileMeta[index]?.lookId||"look-1")===`look-${lookIndex+1}`);
    const selectedVideoTemplate = videoTemplates.find(item => item.id === selectedTemplate) || videoTemplates[0];
    const videoLookCount = selectedVideoTemplate?.lookCount || 5;
    return <div className="studio-wizard">
      <header className="wizard-topbar"><a href="/" className="wizard-brand"><span>L</span><b>LUMERA</b><small>制作工作台</small></a><div className="wizard-project"><i/><span>新建电商素材项目</span><small>生成结果将保留在当前页面</small></div><a href="/history" className="wizard-exit">历史记录 ↗</a><a href="/" className="wizard-exit">退出工作台 ↗</a></header>
      <div className="wizard-shell">
        <aside className="wizard-stepper"><span className="wizard-eyebrow">PRODUCTION FLOW</span><h1>四步完成<br/>商品动态内容</h1><nav>{steps.map(step=><button key={step.id} type="button" disabled={!step.unlocked} className={`${studioView===step.id?"active":""} ${step.done?"complete":""}`} onClick={()=>setStudioView(step.id)}><span>{step.done?"✓":step.number}</span><div><b>{step.name}</b><small>{step.note}</small></div></button>)}</nav><p>每一步确认后才会进入下一步，已有结果可以随时返回查看。</p></aside>
        <main className="wizard-main"><header className="wizard-stage-head"><div><span>STEP {current.number} / 04</span><h2>{current.name}</h2><p>{current.note}</p></div><div className="wizard-progress"><span style={{width:`${Number(current.number)*25}%`}}/></div></header>
          {studioView==="setup" && <section className="wizard-stage-content setup-stage">
            <div className="setup-intro"><h3>先建立人物身份，再组织每套造型</h3><p>人物图会贯穿所有试穿结果；商品按造型分组后，每组会独立生成一套完整穿搭。</p></div>
            <div className="setup-grid"><article className="person-setup-card"><span className="card-label">人物基准</span><input id="wizard-person" className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPersonFile(event.target.files?.[0])}/><label htmlFor="wizard-person">{personPreview?<img src={personPreview} alt="人物基准预览"/>:<div className="empty-upload"><b>＋</b><strong>上传正面全身人物图</strong><small>单人、双手双脚完整、背景简洁</small></div>}</label>{personFile&&<button type="button" onClick={()=>setPersonFile(undefined)}>更换人物图</button>}</article>
              <div className="outfit-setup"><div className="outfit-setup-head"><div><span className="card-label">造型分组</span><h3>{outfitCount} 套造型</h3></div><div><button type="button" onClick={()=>setOutfitCount(value=>Math.max(1,value-1))} disabled={outfitCount<=1||running}>−</button><button type="button" onClick={()=>setOutfitCount(value=>Math.min(5,value+1))} disabled={outfitCount>=5||running}>＋</button></div></div>
                <input id="wizard-products" className="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event)=>{const selected=Array.from(event.target.files||[]);setFiles(selected);setFileMeta(selected.map((_,index)=>({lookId:`look-${(index % outfitCount) + 1}`,category:"上衣"})));}}/><label className="compact-upload" htmlFor="wizard-products">＋ 添加商品图片</label>
                <div className="outfit-card-grid">{Array.from({length:outfitCount},(_,lookIndex)=><article className="outfit-card" key={lookIndex}><header><span>LOOK {String(lookIndex+1).padStart(2,"0")}</span><b>{outfitFiles(lookIndex).length} 件商品</b></header><div className="outfit-assets">{outfitFiles(lookIndex).map(({file,index})=><div className="outfit-asset" key={`${file.name}-${index}`}><img src={previews[index]} alt={file.name}/><select value={fileMeta[index]?.category||"上衣"} onChange={event=>setFileMeta(items=>items.map((item,i)=>i===index?{...item,category:event.target.value}:item))}>{garmentCategories.map(category=><option key={category}>{category}</option>)}</select><select value={fileMeta[index]?.lookId||"look-1"} onChange={event=>setFileMeta(items=>items.map((item,i)=>i===index?{...item,lookId:event.target.value}:item))}>{Array.from({length:outfitCount},(_,i)=><option key={i} value={`look-${i+1}`}>造型 {i+1}</option>)}</select><button type="button" onClick={()=>removeFile(index)}>×</button></div>)}{!outfitFiles(lookIndex).length&&<p>从上方添加商品，再将商品分配到此造型</p>}</div></article>)}</div>
              </div></div><footer className="wizard-actions"><div><b>{personFile&&files.length?"素材已准备":"等待素材"}</b><small>{personFile?"人物图已上传":"还需人物图"} · {files.length?`${files.length} 件商品已上传`:"还需商品图"}</small></div><button className="wizard-primary" onClick={runWhiteStage} disabled={running||!personFile||!files.length}>{running?"正在处理…":"开始生成商品净图 →"}</button></footer>
          </section>}
          {studioView==="white" && <section className="wizard-stage-content review-stage"><div className="review-copy"><h3>逐件检查商品轮廓和颜色</h3><p>确认主体完整、背景纯白、没有残留人物或复杂背景，再进入真人穿搭。</p></div><StageResults title="商品净图" results={results.white} onPreview={setPreviewImage}/><footer className="wizard-actions"><button className="wizard-secondary" onClick={runWhiteStage} disabled={running}>重新生成</button><button className="wizard-primary" onClick={runHollowStage} disabled={running}>确认，生成真人穿搭 →</button></footer></section>}
          {studioView==="hollow" && <section className="wizard-stage-content review-stage"><div className="review-copy"><h3>检查人物身份与每套穿搭</h3><p>重点检查脸型、发型、身材比例是否与人物基准图一致，以及服装是否真正贴合人物。</p></div><div className="local-upload-panel"><div className="local-upload-head"><b>上传已有白底图（可选，跳过商品净图）</b><small>留空则使用上一步结果</small></div><input id="hollow-upload" className="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event)=>{setHollowUploads(Array.from(event.target.files||[]));}}/><label className="compact-upload" htmlFor="hollow-upload">＋ 上传白底商品图</label>{hollowUploadPreviews.length>0&&<div className="upload-thumbs">{hollowUploadPreviews.map((url,index)=><img key={`${url}-${index}`} src={url} alt="白底图"/>)}<button type="button" onClick={()=>{setHollowUploads([]);setHollowUploadPreviews([]);}}>清空</button></div>}</div><div className="identity-compare">{personPreview&&<article><span>人物基准</span><img src={personPreview} alt="人物基准"/></article>}<StageResults title="真人穿搭" results={results.hollow} onPreview={setPreviewImage}/></div><footer className="wizard-actions"><button className="wizard-secondary" onClick={runHollowStage} disabled={running}>重新生成</button><button className="wizard-primary" onClick={()=>setStudioView("video")} disabled={running}>确认，选择视频模板 →</button></footer></section>}
          {studioView==="video" && <section className="wizard-stage-content video-stage"><div className="review-copy"><h3>选择动态模板并生成成片</h3><p>模板决定人物动作、换装节奏和镜头语言；生成前可以反复切换预览。</p></div><div className="local-upload-panel"><div className="local-upload-head"><b>上传穿搭参考图（可选，跳过真人穿搭）</b><small>建议 {videoLookCount} 张，按顺序上传；数量不足也可生成，留空则使用上一步结果</small></div><div className="look-slots">{Array.from({length: videoLookCount}, (_, i) => { const file = videoUploads[i]; return <div className="look-slot" key={i}><input id={`look-slot-${i}`} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{setVideoSlot(i, event.target.files?.[0]);}}/><label htmlFor={`look-slot-${i}`}>{file ? <img src={videoUploadPreviews[i]} alt={`参考图 ${i + 1}`}/> : <span>＋</span>}<small>参考图 {i + 1}</small></label>{file && <button type="button" onClick={()=>setVideoSlot(i, undefined)}>×</button>}</div>; })}</div>{videoUploads.some(Boolean) && <button type="button" onClick={()=>setVideoUploads([])}>清空全部</button>}</div><div className="wizard-template-grid">{videoTemplates.map(template=><button type="button" key={template.id} className={selectedTemplate===template.id?"selected":""} onClick={()=>setSelectedTemplate(template.id)}>{template.previewUrl||template.preview?<video src={template.previewUrl||template.preview} muted loop autoPlay playsInline/>:<img src={template.cover||"/references/look-03.jpeg"} alt=""/>}<span>{template.code}</span><div><b>{template.name}</b><small>{template.lookCount ? `建议 ${template.lookCount} 张参考图 · ` : ""}{template.description}</small></div><i>{selectedTemplate===template.id?"✓":""}</i></button>)}</div>{results.video.length>0&&<StageResults title="最终动态视频" results={results.video} onPreview={setPreviewImage}/>}<footer className="wizard-actions"><div><b>{videoTemplates.find(item=>item.id===selectedTemplate)?.name}</b><small>10 秒 · 9:16 · 30fps · 建议 {videoTemplates.find(item=>item.id===selectedTemplate)?.lookCount || 5} 张参考图</small></div><button className="wizard-primary" onClick={runVideoStage} disabled={running}>{running?"正在生成视频…":results.video.length?"重新生成视频":"生成最终视频 →"}</button></footer></section>}
          {message&&<div className={`wizard-message ${message.startsWith("已完成")?"success":"error"}`}>{message}</div>}
        </main>
      </div>{previewImage&&<div className="image-lightbox" role="dialog" aria-modal="true" onClick={()=>setPreviewImage(undefined)}><button type="button" onClick={()=>setPreviewImage(undefined)}>×</button><img src={previewImage} alt="生成结果细节" onClick={event=>event.stopPropagation()}/></div>}{showSubscription&&<div className="subscription-backdrop" role="dialog" aria-modal="true" onClick={()=>setShowSubscription(false)}><section className="subscription-modal" onClick={event=>event.stopPropagation()}><header><div><span>MEMBERSHIP</span><h2>升级会员，解锁无限创作</h2><p>免费版：白底图 5 次、真人穿搭 3 次，视频生成需订阅。选择方案解锁更多额度。</p></div><button onClick={()=>setShowSubscription(false)} aria-label="关闭">×</button></header><div className="subscription-plans">{loadPlans().map(plan=><article key={plan.id} className={plan.popular?"popular":""}>{plan.popular&&<span className="popular-badge">最受欢迎</span>}<h3>{plan.name}</h3><div className="plan-price">{plan.price}<small>{plan.period}</small></div><p>{plan.desc}</p><ul>{plan.features.map((feature,i)=><li key={i}>✓ {feature}</li>)}</ul><button onClick={()=>subscribe(plan)}>{plan.id==="free"?"暂不订阅":"立即订阅"}</button></article>)}</div></section></div>}
    </div>;
  }
  return <div className={`test-shell ${embedded ? "embedded-test-shell" : ""}`}>{!embedded && <header className="test-head"><div><span className="kicker">UNIFIED WORKSPACE</span><h1>API 配置与流水线测试台</h1><p>在一个页面完成接口接入、素材上传、分阶段生成与结果验收。</p></div><a className="back" href="/">← 返回调度中心</a></header>}
    {!embedded && <section className="inline-api"><div className="inline-api-head"><div><span className="kicker">01 · API CONNECTIONS</span><h2>智能体接口接入</h2><p>配置保存在当前浏览器，保存后可直接在下方运行。</p></div><button className="primary" onClick={saveConnections}>{connectionSaved ? "已保存 ✓" : "保存全部 API"}</button></div>
      <div className="api-grid compact-api-grid">{requiredAgents.map(([id, name], index) => { const colors = ["#ffcf58", "#ff8a4c", "#8a6cff", "#d7ff44", "#31c7a2"]; const ready = Boolean(connections[id]?.url); const placeholder = id === "orchestrator" ? "https://api.deepseek.com/chat/completions" : id === "product-white-bg" ? "https://api.remove.bg/v1.0/removebg" : id === "hollow-look" ? "https://api.modelverse.cn/v1/images/generations" : "https://api.modelverse.cn/v1/tasks/submit"; return <article key={id} style={{"--accent":colors[index]} as React.CSSProperties}><div className="api-card-head"><span>{index === 0 ? "P" : `0${index}`}</span><b className={ready ? "connected" : "disconnected"}>{ready ? "● 已填写" : "○ 待配置"}</b></div><h3>{name}</h3><label className="api-field"><span>API 地址</span><input type="url" placeholder={placeholder} value={connections[id]?.url || ""} onChange={(event) => updateConnection(id, "url", event.target.value)}/></label><label className="api-field"><span>API Key</span><input type="password" placeholder="粘贴 API Key" value={connections[id]?.token || ""} onChange={(event) => updateConnection(id, "token", event.target.value)}/></label>{modelDefaults[id] && <label className="api-field"><span>模型（可选）</span><input type="text" placeholder={modelDefaults[id]} value={connections[id]?.model || ""} onChange={(event) => updateConnection(id, "model", event.target.value)}/></label>}</article>})}</div>
    </section>}
    <section className="tester staged-tester"><div className="test-panel task-creator"><span className="workspace-step">NEW PROJECT</span><h2>上传商品素材</h2>
      <div className="outfit-builder-head"><div><b>造型分组</b><small>先确定造型套数，再为每件商品选择所属造型和商品类别。</small></div><div><button type="button" disabled={running||outfitCount<=1} onClick={()=>setOutfitCount(value=>Math.max(1,value-1))}>−</button><span>{outfitCount} 套</span><button type="button" disabled={running||outfitCount>=5} onClick={()=>setOutfitCount(value=>Math.min(5,value+1))}>＋</button></div></div>
      <input id="product-images" className="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => {const selected=Array.from(event.target.files || []);setFiles(selected);setFileMeta(selected.map((_,index)=>({lookId:`look-${(index % outfitCount) + 1}`,category:"上衣"})));}}/><label className="dropzone upload-zone" htmlFor="product-images"><span className="upload-icon">＋</span><b>点击上传每套造型的商品图片</b><p>一套可包含上衣、下装、鞋、包和配饰</p><span className="upload-action">选择商品图片</span></label>
      {files.length > 0 && <div className="upload-list grouped-upload-list">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}`}><img src={previews[index]} alt={file.name}/><div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small><div className="asset-classifiers"><select value={fileMeta[index]?.lookId||"look-1"} onChange={event=>setFileMeta(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,lookId:event.target.value}:item))}>{Array.from({length:outfitCount},(_,lookIndex)=><option key={lookIndex} value={`look-${lookIndex+1}`}>造型 {lookIndex+1}</option>)}</select><select value={fileMeta[index]?.category||"上衣"} onChange={event=>setFileMeta(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,category:event.target.value}:item))}>{garmentCategories.map(category=><option key={category}>{category}</option>)}</select></div></div><button type="button" disabled={running} onClick={() => removeFile(index)} aria-label={`移除 ${file.name}`}>×</button></article>)}</div>}
      <div className="identity-upload"><input id="identity-image" className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPersonFile(event.target.files?.[0])}/><label htmlFor="identity-image">{personPreview?<img src={personPreview} alt="人物基准预览"/>:<span>＋</span>}<div><b>{personFile?"人物基准图已选择":"上传人物基准图"}</b><small>建议正面全身、单人、双手双脚完整、背景简洁</small></div></label></div>
      <div className="connection-check"><b>生产服务状态</b><span>{configured.length}/5 已就绪</span>{configured.length < 5 && <a href="/admin">联系管理员配置 ↗</a>}</div>
      <div className="formrow"><div className="field"><label>造型套数</label><input value={`${outfitCount} 套`} readOnly/></div><div className="field"><label>失败重试</label><select value={retryLimit} disabled={running} onChange={(event) => setRetryLimit(event.target.value)}><option value="2">2 次</option><option value="1">1 次</option><option value="0">不重试</option></select></div></div>
      <div className="template-picker"><header><div><span>VIDEO TEMPLATE</span><b>选择动态视频模板</b></div><small>已选择 {videoTemplates.find(item => item.id === selectedTemplate)?.code}</small></header><div className="template-grid">{videoTemplates.map(template => <button type="button" key={template.id} className={selectedTemplate === template.id ? "selected" : ""} onClick={() => setSelectedTemplate(template.id)} disabled={running}>{template.previewUrl || template.preview ? <video src={template.previewUrl || template.preview} muted playsInline loop autoPlay/> : <img src={template.cover || "/references/look-03.jpeg"} alt=""/>}<span className="template-code">{template.code}</span><div><b>{template.name}</b><p>{template.description}</p></div><i>{selectedTemplate === template.id ? "✓" : ""}</i></button>)}</div></div>
      <div className="manual-stage-actions"><button className="primary full" onClick={runWhiteStage} disabled={running}>{stages.white === "done" ? "重新生成商品净图" : "第一步 · 生成商品净图"}</button><button className="primary full" onClick={runHollowStage} disabled={running || stages.white !== "done"}>{stages.hollow === "done" ? "重新生成真人穿搭" : "下一步 · 生成真人穿搭"}</button><button className="primary full" onClick={runVideoStage} disabled={running || stages.hollow !== "done"}>{stages.video === "done" ? "重新生成动态视频" : "下一步 · 生成动态商拍"}</button></div>{message && <div className={`test-message ${message.startsWith("已完成") ? "success" : "error"}`}>{message}</div>}
    </div><div className="test-panel result-workspace"><span className="workspace-step">PROJECT OUTPUT</span><h2>素材生成进度</h2><div className="tree">
      <div className={`tree-node parent ${stages.parent}`}><span className="num">◆</span><div><b>项目准备</b><small>素材检查与生成计划</small></div><span>{statusText(stages.parent)}</span></div><div className="tree-line"/>
      <div className={`tree-node ${stages.white}`}><span className="num">01</span><div><b>商品净图</b><small>完成后展示标准白底商品图</small></div><span>{statusText(stages.white)}</span></div><StageResults title="商品净图结果" results={results.white} onPreview={setPreviewImage}/><div className="tree-line"/>
      <div className={`tree-node ${stages.hollow}`}><span className="num">02</span><div><b>真人穿搭</b><small>展示同人物完整穿搭结果</small></div><span>{statusText(stages.hollow)}</span></div><StageResults title="真人穿搭结果" results={results.hollow} onPreview={setPreviewImage}/><div className="tree-line"/>
      <div className={`tree-node ${stages.video}`}><span className="num">03</span><div><b>动态商拍</b><small>展示最终 10 秒竖版视频</small></div><span>{statusText(stages.video)}</span></div><StageResults title="动态商拍视频" results={results.video} onPreview={setPreviewImage}/>
    </div></div></section>{previewImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="图片细节预览" onClick={() => setPreviewImage(undefined)}><button type="button" onClick={() => setPreviewImage(undefined)} aria-label="关闭预览">×</button><img src={previewImage} alt="放大后的生成结果" onClick={(event) => event.stopPropagation()}/></div>}</div>;
}

export default function TestPage() {
  useEffect(() => { window.location.replace("/studio"); }, []);
  return null;
}
