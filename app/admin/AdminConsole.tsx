"use client";

import { useEffect, useMemo, useState } from "react";
import { agents, orchestrator } from "../../lib/agents";

type Connections = Record<string, { url: string; token: string }>;
type ApiStatus = { id: string; name: string; connected: boolean };

const systems = [
  { id: "orchestrator", code: "CORE", name: "流程决策服务", desc: "负责项目规划、结果校验和失败重试", color: "#d5ff45", placeholder: "https://api.deepseek.com/chat/completions" },
  { id: "product-white-bg", code: "IMG-01", name: "商品净图服务", desc: "负责主体识别、背景清理和标准化输出", color: "#78a7ff", placeholder: "https://api.remove.bg/v1.0/removebg" },
  { id: "hollow-look", code: "IMG-02", name: "穿搭陈列服务", desc: "负责商品组合、隐形人台和穿搭合成", color: "#c792ff", placeholder: "https://api.modelverse.cn/v1/images/generations" },
  { id: "snap-change-video", code: "VID-01", name: "动态商拍服务", desc: "负责人物一致性、动作和变装视频生成", color: "#51ddb5", placeholder: "https://api.modelverse.cn/v1/tasks/submit" },
];

export default function AdminConsole() {
  const [active, setActive] = useState("connections");
  const [connections, setConnections] = useState<Connections>({});
  const [status, setStatus] = useState<ApiStatus[]>([]);
  const [saved, setSaved] = useState(false);
  const [promptId, setPromptId] = useState("orchestrator");
  const [prompts, setPrompts] = useState<Record<string,string>>({});
  const [showKeys, setShowKeys] = useState<Record<string,boolean>>({});
  const [templateFile, setTemplateFile] = useState<File>();
  const [templateForm, setTemplateForm] = useState({ code: "D", name: "", description: "", prompt: "", enabled: true });
  const [templateMessage, setTemplateMessage] = useState("");
  const [cloudTemplates, setCloudTemplates] = useState<Array<{id:string;code:string;name:string;enabled:boolean;description:string;prompt:string;previewUrl?:string}>>([]);
  const [galleryVideo, setGalleryVideo] = useState<File>();
  const [galleryPoster, setGalleryPoster] = useState<File>();
  const [galleryForm, setGalleryForm] = useState({ title: "", category: "响指变装", description: "", prompt: "", sortOrder: 1, enabled: true });
  const [galleryMessage, setGalleryMessage] = useState("");
  const [galleryVideos, setGalleryVideos] = useState<Array<{id:string;title:string;category:string;description:string;prompt:string;sortOrder:number;enabled:boolean;videoUrl?:string;posterUrl?:string}>>([]);

  useEffect(() => {
    const defaults: Record<string,string> = { orchestrator: orchestrator.prompt };
    agents.forEach((agent) => defaults[agent.id] = agent.prompt);
    setPrompts({ ...defaults, ...JSON.parse(localStorage.getItem("lumera-prompts") || localStorage.getItem("snapflow-prompts") || "{}") });
    setConnections(JSON.parse(localStorage.getItem("lumera-connections") || localStorage.getItem("snapflow-connections") || "{}"));
    fetch("/api/agents/status").then(r => r.json()).then(data => setStatus(data.agents || [])).catch(() => setStatus([]));
  }, []);
  function refreshTemplates() { fetch("/api/video-templates").then(response => response.json()).then(data => setCloudTemplates(data.templates || [])).catch(() => setCloudTemplates([])); }
  useEffect(() => { refreshTemplates(); }, []);
  function refreshGallery() { fetch("/api/prompt-videos?all=1").then(response => response.json()).then(data => setGalleryVideos(data.videos || [])).catch(() => setGalleryVideos([])); }
  useEffect(() => { refreshGallery(); }, []);

  const configuredCount = systems.filter(item => status.find(s => s.id === item.id)?.connected || connections[item.id]?.url).length;
  const currentPrompt = useMemo(() => promptId === "orchestrator" ? orchestrator : agents.find(agent => agent.id === promptId)!, [promptId]);
  function update(id:string, field:"url"|"token", value:string) { setConnections(current => ({...current,[id]:{url:current[id]?.url || "",token:current[id]?.token || "",[field]:value}})); }
  function saveAll() {
    localStorage.setItem("lumera-connections", JSON.stringify(connections));
    localStorage.setItem("snapflow-connections", JSON.stringify(connections));
    localStorage.setItem("lumera-prompts", JSON.stringify(prompts));
    localStorage.setItem("snapflow-prompts", JSON.stringify(prompts));
    window.dispatchEvent(new Event("snapflow-connections-updated")); setSaved(true); setTimeout(() => setSaved(false), 1800);
  }
  async function saveTemplate() {
    if (!templateForm.name || !templateForm.prompt) return setTemplateMessage("请填写模板名称和生成规则");
    const form = new FormData(); Object.entries(templateForm).forEach(([key,value]) => form.append(key,String(value))); if (templateFile) form.append("file",templateFile);
    setTemplateMessage("正在上传并保存……");
    const response = await fetch("/api/video-templates", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setTemplateMessage(result.error || "模板保存失败");
    setTemplateMessage("模板已保存，前台刷新后即可选择 ✓"); setTemplateFile(undefined); setTemplateForm({ code: "D", name: "", description: "", prompt: "", enabled: true }); refreshTemplates();
  }
  async function toggleTemplate(template: {id:string;code:string;name:string;enabled:boolean;description:string;prompt:string;previewUrl?:string}) {
    const form = new FormData(); Object.entries({...template,enabled:!template.enabled}).forEach(([key,value]) => form.append(key,String(value ?? "")));
    await fetch("/api/video-templates", { method:"POST", body:form }); refreshTemplates();
  }
  async function saveGalleryVideo() {
    if (!galleryForm.title || !galleryForm.prompt) return setGalleryMessage("请填写视频名称和完整提示词");
    const form = new FormData(); Object.entries(galleryForm).forEach(([key,value]) => form.append(key,String(value))); if (galleryVideo) form.append("video",galleryVideo); if (galleryPoster) form.append("poster",galleryPoster);
    setGalleryMessage("正在上传并保存……");
    const response = await fetch("/api/prompt-videos", { method:"POST", body:form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setGalleryMessage(result.error || "视频保存失败");
    setGalleryMessage("视频灵感已保存，前台刷新后即可查看 ✓"); setGalleryVideo(undefined); setGalleryPoster(undefined); setGalleryForm({ title:"",category:"响指变装",description:"",prompt:"",sortOrder:galleryVideos.length + 2,enabled:true }); refreshGallery();
  }
  async function toggleGalleryVideo(video: {id:string;title:string;category:string;description:string;prompt:string;sortOrder:number;enabled:boolean;videoUrl?:string;posterUrl?:string}) {
    const form = new FormData(); Object.entries({...video,enabled:!video.enabled}).forEach(([key,value]) => form.append(key,String(value ?? "")));
    await fetch("/api/prompt-videos", { method:"POST",body:form }); refreshGallery();
  }
  async function deleteGalleryVideo(id:string) {
    if (!window.confirm("确定删除这个视频灵感及其上传文件吗？")) return;
    await fetch("/api/prompt-videos", { method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id}) }); refreshGallery();
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><span>L</span><div><b>LUMERA</b><small>OPERATIONS</small></div></a><nav>
      <button className={active === "overview" ? "active" : ""} onClick={() => setActive("overview")}><i>⌂</i><span>运行概览</span></button>
      <button className={active === "connections" ? "active" : ""} onClick={() => setActive("connections")}><i>⌁</i><span>服务接入</span></button>
      <button className={active === "prompts" ? "active" : ""} onClick={() => setActive("prompts")}><i>✦</i><span>生成策略</span></button>
      <button className={active === "templates" ? "active" : ""} onClick={() => setActive("templates")}><i>▷</i><span>视频模板</span></button>
      <button className={active === "gallery" ? "active" : ""} onClick={() => setActive("gallery")}><i>◉</i><span>视频灵感库</span></button>
      <button className={active === "diagnostics" ? "active" : ""} onClick={() => setActive("diagnostics")}><i>◫</i><span>接口诊断</span></button>
    </nav><div className="admin-sidefoot"><i/><span>服务控制台在线</span><a href="/">返回前台 ↗</a></div></aside>
    <section className="admin-main"><header className="admin-topbar"><div><span>COMMERCE CONTENT OS</span><h1>{active === "overview" ? "运行概览" : active === "connections" ? "服务接入" : active === "prompts" ? "生成策略" : active === "templates" ? "视频模板" : active === "gallery" ? "视频灵感库" : "接口诊断"}</h1></div><div className="admin-user"><span>LY</span><div><b>内容管理员</b><small>Administrator</small></div></div></header>

      {active === "overview" && <div className="admin-content"><div className="admin-welcome"><div><span>GOOD MORNING</span><h2>今天的内容生产系统<br/>运行稳定。</h2><p>所有素材处理服务均通过统一后端调用，前台不展示接口与密钥。</p></div><div className="health-ring"><b>{configuredCount}/4</b><span>服务已连接</span></div></div><div className="stat-grid"><article><span>今日项目</span><b>12</b><small>较昨日 +18%</small></article><article><span>已生成素材</span><b>48</b><small>成功率 96.8%</small></article><article><span>平均处理时间</span><b>3m 42s</b><small>近 7 日均值</small></article></div><div className="activity-panel"><header><h3>生产链路</h3><span>实时状态</span></header>{systems.map((item,index) => <div className="activity-row" key={item.id}><i style={{background:item.color}}/><b>{item.name}</b><span>{item.desc}</span><em>{status.find(s => s.id === item.id)?.connected || connections[item.id]?.url ? "运行中" : "待接入"}</em><small>0{index + 1}</small></div>)}</div></div>}

      {active === "connections" && <div className="admin-content"><div className="content-heading"><div><span>BACKEND CONNECTIONS</span><h2>模型与服务接入</h2><p>集中管理生产链路使用的服务地址和访问密钥。前台用户不会看到这些信息。</p></div><button onClick={saveAll}>{saved ? "配置已保存 ✓" : "保存全部配置"}</button></div><div className="secure-notice"><i>⌾</i><div><b>安全接入说明</b><p>正式线上环境优先读取服务端环境变量；此处填写的配置用于当前设备联调，不会出现在公开制作页面。</p></div><span>{configuredCount}/4 READY</span></div><div className="connection-list">{systems.map(item => { const server = status.find(s => s.id === item.id)?.connected; const local = Boolean(connections[item.id]?.url); return <article key={item.id} style={{"--service-color":item.color} as React.CSSProperties}><header><span>{item.code}</span><div><h3>{item.name}</h3><p>{item.desc}</p></div><b className={server || local ? "online" : "offline"}>{server ? "服务端已配置" : local ? "本机已配置" : "等待配置"}</b></header><div className="connection-fields"><label><span>API ENDPOINT</span><input type="url" value={connections[item.id]?.url || ""} placeholder={server ? "已使用服务端安全地址" : item.placeholder} onChange={e => update(item.id,"url",e.target.value)}/></label><label><span>ACCESS KEY</span><div className="secret-field"><input type={showKeys[item.id] ? "text" : "password"} value={connections[item.id]?.token || ""} placeholder={server ? "服务端密钥已安全配置" : "输入 API Key"} onChange={e => update(item.id,"token",e.target.value)}/><button onClick={() => setShowKeys(keys => ({...keys,[item.id]:!keys[item.id]}))}>{showKeys[item.id] ? "隐藏" : "显示"}</button></div></label></div></article>})}</div></div>}

      {active === "prompts" && <div className="admin-content"><div className="content-heading"><div><span>GENERATION POLICIES</span><h2>生成策略管理</h2><p>调整每个内容环节的质量标准、画面要求与失败约束。</p></div><button onClick={saveAll}>{saved ? "策略已保存 ✓" : "保存策略"}</button></div><div className="policy-editor"><aside>{[{id:"orchestrator",name:"流程决策",label:"全局"},...agents.map(a=>({id:a.id,name:a.name,label:a.order}))].map(item => <button key={item.id} className={promptId === item.id ? "active" : ""} onClick={() => setPromptId(item.id)}><span>{item.label}</span><div><b>{item.name}</b><small>{item.id === "orchestrator" ? "流程规划与质量验收" : agents.find(a=>a.id===item.id)?.subtitle}</small></div></button>)}</aside><section><header><div><span>ACTIVE POLICY</span><h3>{currentPrompt.name}</h3></div><b>v1.0 · 已启用</b></header><textarea value={prompts[promptId] || ""} onChange={e => setPrompts({...prompts,[promptId]:e.target.value})}/><footer><span>{(prompts[promptId] || "").length} 字符</span><span>保存后应用于下一次生成</span></footer></section></div></div>}

      {active === "templates" && <div className="admin-content"><div className="content-heading"><div><span>VIDEO TEMPLATE LIBRARY</span><h2>视频模板库</h2><p>上传 MP4 预览视频并配置该模板专属的镜头、动作与转场规则。</p></div><a href="/#studio">查看前台模板 ↗</a></div><div className="template-admin"><label className="template-upload"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setTemplateFile(event.target.files?.[0])}/><span>＋</span><b>{templateFile ? templateFile.name : "上传模板预览视频"}</b><small>支持 MP4、WebM、MOV</small></label><section><div className="template-form-row"><label><span>模板编号</span><input value={templateForm.code} onChange={e=>setTemplateForm({...templateForm,code:e.target.value})}/></label><label><span>模板名称</span><input placeholder="例如：街拍推镜变装" value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})}/></label></div><label><span>模板说明</span><input placeholder="向用户简要说明这个模板的效果" value={templateForm.description} onChange={e=>setTemplateForm({...templateForm,description:e.target.value})}/></label><label><span>专属生成规则</span><textarea placeholder="描述镜头、人物动作、转场时机、服装变化方式和结尾效果" value={templateForm.prompt} onChange={e=>setTemplateForm({...templateForm,prompt:e.target.value})}/></label><div className="template-form-actions"><label><input type="checkbox" checked={templateForm.enabled} onChange={e=>setTemplateForm({...templateForm,enabled:e.target.checked})}/> 保存后立即在前台启用</label><button onClick={saveTemplate}>上传并保存模板</button></div>{templateMessage && <p className="template-message">{templateMessage}</p>}</section></div>{cloudTemplates.length > 0 && <div className="template-library-list"><header><b>已上传模板</b><span>{cloudTemplates.length} 个</span></header>{cloudTemplates.map(template => <article key={template.id}>{template.previewUrl ? <video src={template.previewUrl} muted playsInline controls/> : <div className="template-empty">{template.code}</div>}<div><span>{template.code}</span><b>{template.name}</b><p>{template.description}</p></div><button className={template.enabled ? "enabled" : "disabled"} onClick={()=>toggleTemplate(template)}>{template.enabled ? "已启用" : "已停用"}</button></article>)}</div>}</div>}

      {active === "gallery" && <div className="admin-content"><div className="content-heading"><div><span>VIDEO PROMPT GALLERY</span><h2>视频灵感库</h2><p>管理前台六宫格视频案例及用户可以直接复制使用的完整提示词。</p></div><a href="/#video-gallery">查看前台灵感库 ↗</a></div><div className="template-admin gallery-admin"><div className="gallery-upload-stack"><label className="template-upload"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event=>setGalleryVideo(event.target.files?.[0])}/><span>＋</span><b>{galleryVideo ? galleryVideo.name : "上传案例视频"}</b><small>支持 MP4、WebM、MOV</small></label><label className="template-upload poster-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setGalleryPoster(event.target.files?.[0])}/><span>▧</span><b>{galleryPoster ? galleryPoster.name : "上传视频封面（可选）"}</b><small>支持 JPG、PNG、WebP</small></label></div><section><div className="template-form-row"><label><span>视频名称</span><input placeholder="例如：六套响指循环变装" value={galleryForm.title} onChange={e=>setGalleryForm({...galleryForm,title:e.target.value})}/></label><label><span>分类标签</span><input placeholder="例如：响指变装" value={galleryForm.category} onChange={e=>setGalleryForm({...galleryForm,category:e.target.value})}/></label></div><div className="template-form-row"><label><span>简短说明</span><input placeholder="说明这个视频适合的使用场景" value={galleryForm.description} onChange={e=>setGalleryForm({...galleryForm,description:e.target.value})}/></label><label><span>展示顺序</span><input type="number" min="1" max="99" value={galleryForm.sortOrder} onChange={e=>setGalleryForm({...galleryForm,sortOrder:Number(e.target.value)})}/></label></div><label><span>用户可复制的完整提示词</span><textarea placeholder="填写完整提示词，前台用户可直接一键复制全部内容" value={galleryForm.prompt} onChange={e=>setGalleryForm({...galleryForm,prompt:e.target.value})}/></label><div className="template-form-actions"><label><input type="checkbox" checked={galleryForm.enabled} onChange={e=>setGalleryForm({...galleryForm,enabled:e.target.checked})}/> 保存后立即在前台启用</label><button onClick={saveGalleryVideo}>上传并发布到灵感库</button></div>{galleryMessage && <p className="template-message">{galleryMessage}</p>}</section></div>{galleryVideos.length > 0 && <div className="template-library-list gallery-library-list"><header><b>已上传视频灵感</b><span>{galleryVideos.length} / 6 个启用位</span></header>{galleryVideos.map(video=><article key={video.id}>{video.videoUrl ? <video src={video.videoUrl} poster={video.posterUrl} muted playsInline controls/> : <div className="template-empty">VIDEO</div>}<div><span>{video.category} · 排序 {video.sortOrder}</span><b>{video.title}</b><p>{video.description}</p></div><button className={video.enabled ? "enabled" : "disabled"} onClick={()=>toggleGalleryVideo(video)}>{video.enabled ? "已启用" : "已停用"}</button><button className="gallery-delete" onClick={()=>deleteGalleryVideo(video.id)}>删除</button></article>)}</div>}</div>}

      {active === "diagnostics" && <div className="admin-content"><div className="content-heading"><div><span>SERVICE DIAGNOSTICS</span><h2>接口诊断</h2><p>上线前检查每项服务是否已经连接，并快速定位缺失配置。</p></div><a href="/#studio">打开前台制作中心 ↗</a></div><div className="diagnostic-grid">{systems.map(item => { const ready = status.find(s => s.id === item.id)?.connected || connections[item.id]?.url; return <article key={item.id}><div className="diag-icon" style={{background:item.color}}>{ready ? "✓" : "!"}</div><span>{item.code}</span><h3>{item.name}</h3><p>{item.desc}</p><footer><b className={ready ? "pass" : "warn"}>{ready ? "连接正常" : "需要配置"}</b><button onClick={() => setActive("connections")}>查看配置 →</button></footer></article>})}</div><div className="route-panel"><span>PUBLIC BACKEND ROUTE</span><code>POST /api/agents/[serviceId]/run</code><p>前台生成请求统一发送到本站后端，再由后端调用已配置的第三方模型服务。</p></div></div>}
    </section>
  </main>;
}
