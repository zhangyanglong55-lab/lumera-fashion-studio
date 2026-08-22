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

  useEffect(() => {
    const defaults: Record<string,string> = { orchestrator: orchestrator.prompt };
    agents.forEach((agent) => defaults[agent.id] = agent.prompt);
    setPrompts({ ...defaults, ...JSON.parse(localStorage.getItem("lumera-prompts") || localStorage.getItem("snapflow-prompts") || "{}") });
    setConnections(JSON.parse(localStorage.getItem("lumera-connections") || localStorage.getItem("snapflow-connections") || "{}"));
    fetch("/api/agents/status").then(r => r.json()).then(data => setStatus(data.agents || [])).catch(() => setStatus([]));
  }, []);
  function refreshTemplates() { fetch("/api/video-templates").then(response => response.json()).then(data => setCloudTemplates(data.templates || [])).catch(() => setCloudTemplates([])); }
  useEffect(() => { refreshTemplates(); }, []);

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

  return <main className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><span>L</span><div><b>LUMERA</b><small>OPERATIONS</small></div></a><nav>
      <button className={active === "overview" ? "active" : ""} onClick={() => setActive("overview")}><i>⌂</i><span>运行概览</span></button>
      <button className={active === "connections" ? "active" : ""} onClick={() => setActive("connections")}><i>⌁</i><span>服务接入</span></button>
      <button className={active === "prompts" ? "active" : ""} onClick={() => setActive("prompts")}><i>✦</i><span>生成策略</span></button>
      <button className={active === "templates" ? "active" : ""} onClick={() => setActive("templates")}><i>▷</i><span>视频模板</span></button>
      <button className={active === "diagnostics" ? "active" : ""} onClick={() => setActive("diagnostics")}><i>◫</i><span>接口诊断</span></button>
    </nav><div className="admin-sidefoot"><i/><span>服务控制台在线</span><a href="/">返回前台 ↗</a></div></aside>
    <section className="admin-main"><header className="admin-topbar"><div><span>COMMERCE CONTENT OS</span><h1>{active === "overview" ? "运行概览" : active === "connections" ? "服务接入" : active === "prompts" ? "生成策略" : active === "templates" ? "视频模板" : "接口诊断"}</h1></div><div className="admin-user"><span>LY</span><div><b>内容管理员</b><small>Administrator</small></div></div></header>

      {active === "overview" && <div className="admin-content"><div className="admin-welcome"><div><span>GOOD MORNING</span><h2>今天的内容生产系统<br/>运行稳定。</h2><p>所有素材处理服务均通过统一后端调用，前台不展示接口与密钥。</p></div><div className="health-ring"><b>{configuredCount}/4</b><span>服务已连接</span></div></div><div className="stat-grid"><article><span>今日项目</span><b>12</b><small>较昨日 +18%</small></article><article><span>已生成素材</span><b>48</b><small>成功率 96.8%</small></article><article><span>平均处理时间</span><b>3m 42s</b><small>近 7 日均值</small></article></div><div className="activity-panel"><header><h3>生产链路</h3><span>实时状态</span></header>{systems.map((item,index) => <div className="activity-row" key={item.id}><i style={{background:item.color}}/><b>{item.name}</b><span>{item.desc}</span><em>{status.find(s => s.id === item.id)?.connected || connections[item.id]?.url ? "运行中" : "待接入"}</em><small>0{index + 1}</small></div>)}</div></div>}

      {active === "connections" && <div className="admin-content"><div className="content-heading"><div><span>BACKEND CONNECTIONS</span><h2>模型与服务接入</h2><p>集中管理生产链路使用的服务地址和访问密钥。前台用户不会看到这些信息。</p></div><button onClick={saveAll}>{saved ? "配置已保存 ✓" : "保存全部配置"}</button></div><div className="secure-notice"><i>⌾</i><div><b>安全接入说明</b><p>正式线上环境优先读取服务端环境变量；此处填写的配置用于当前设备联调，不会出现在公开制作页面。</p></div><span>{configuredCount}/4 READY</span></div><div className="connection-list">{systems.map(item => { const server = status.find(s => s.id === item.id)?.connected; const local = Boolean(connections[item.id]?.url); return <article key={item.id} style={{"--service-color":item.color} as React.CSSProperties}><header><span>{item.code}</span><div><h3>{item.name}</h3><p>{item.desc}</p></div><b className={server || local ? "online" : "offline"}>{server ? "服务端已配置" : local ? "本机已配置" : "等待配置"}</b></header><div className="connection-fields"><label><span>API ENDPOINT</span><input type="url" value={connections[item.id]?.url || ""} placeholder={server ? "已使用服务端安全地址" : item.placeholder} onChange={e => update(item.id,"url",e.target.value)}/></label><label><span>ACCESS KEY</span><div className="secret-field"><input type={showKeys[item.id] ? "text" : "password"} value={connections[item.id]?.token || ""} placeholder={server ? "服务端密钥已安全配置" : "输入 API Key"} onChange={e => update(item.id,"token",e.target.value)}/><button onClick={() => setShowKeys(keys => ({...keys,[item.id]:!keys[item.id]}))}>{showKeys[item.id] ? "隐藏" : "显示"}</button></div></label></div></article>})}</div></div>}

      {active === "prompts" && <div className="admin-content"><div className="content-heading"><div><span>GENERATION POLICIES</span><h2>生成策略管理</h2><p>调整每个内容环节的质量标准、画面要求与失败约束。</p></div><button onClick={saveAll}>{saved ? "策略已保存 ✓" : "保存策略"}</button></div><div className="policy-editor"><aside>{[{id:"orchestrator",name:"流程决策",label:"全局"},...agents.map(a=>({id:a.id,name:a.name,label:a.order}))].map(item => <button key={item.id} className={promptId === item.id ? "active" : ""} onClick={() => setPromptId(item.id)}><span>{item.label}</span><div><b>{item.name}</b><small>{item.id === "orchestrator" ? "流程规划与质量验收" : agents.find(a=>a.id===item.id)?.subtitle}</small></div></button>)}</aside><section><header><div><span>ACTIVE POLICY</span><h3>{currentPrompt.name}</h3></div><b>v1.0 · 已启用</b></header><textarea value={prompts[promptId] || ""} onChange={e => setPrompts({...prompts,[promptId]:e.target.value})}/><footer><span>{(prompts[promptId] || "").length} 字符</span><span>保存后应用于下一次生成</span></footer></section></div></div>}

      {active === "templates" && <div className="admin-content"><div className="content-heading"><div><span>VIDEO TEMPLATE LIBRARY</span><h2>视频模板库</h2><p>上传 MP4 预览视频并配置该模板专属的镜头、动作与转场规则。</p></div><a href="/#studio">查看前台模板 ↗</a></div><div className="template-admin"><label className="template-upload"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setTemplateFile(event.target.files?.[0])}/><span>＋</span><b>{templateFile ? templateFile.name : "上传模板预览视频"}</b><small>支持 MP4、WebM、MOV</small></label><section><div className="template-form-row"><label><span>模板编号</span><input value={templateForm.code} onChange={e=>setTemplateForm({...templateForm,code:e.target.value})}/></label><label><span>模板名称</span><input placeholder="例如：街拍推镜变装" value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})}/></label></div><label><span>模板说明</span><input placeholder="向用户简要说明这个模板的效果" value={templateForm.description} onChange={e=>setTemplateForm({...templateForm,description:e.target.value})}/></label><label><span>专属生成规则</span><textarea placeholder="描述镜头、人物动作、转场时机、服装变化方式和结尾效果" value={templateForm.prompt} onChange={e=>setTemplateForm({...templateForm,prompt:e.target.value})}/></label><div className="template-form-actions"><label><input type="checkbox" checked={templateForm.enabled} onChange={e=>setTemplateForm({...templateForm,enabled:e.target.checked})}/> 保存后立即在前台启用</label><button onClick={saveTemplate}>上传并保存模板</button></div>{templateMessage && <p className="template-message">{templateMessage}</p>}</section></div>{cloudTemplates.length > 0 && <div className="template-library-list"><header><b>已上传模板</b><span>{cloudTemplates.length} 个</span></header>{cloudTemplates.map(template => <article key={template.id}>{template.previewUrl ? <video src={template.previewUrl} muted playsInline controls/> : <div className="template-empty">{template.code}</div>}<div><span>{template.code}</span><b>{template.name}</b><p>{template.description}</p></div><button className={template.enabled ? "enabled" : "disabled"} onClick={()=>toggleTemplate(template)}>{template.enabled ? "已启用" : "已停用"}</button></article>)}</div>}</div>}

      {active === "diagnostics" && <div className="admin-content"><div className="content-heading"><div><span>SERVICE DIAGNOSTICS</span><h2>接口诊断</h2><p>上线前检查每项服务是否已经连接，并快速定位缺失配置。</p></div><a href="/#studio">打开前台制作中心 ↗</a></div><div className="diagnostic-grid">{systems.map(item => { const ready = status.find(s => s.id === item.id)?.connected || connections[item.id]?.url; return <article key={item.id}><div className="diag-icon" style={{background:item.color}}>{ready ? "✓" : "!"}</div><span>{item.code}</span><h3>{item.name}</h3><p>{item.desc}</p><footer><b className={ready ? "pass" : "warn"}>{ready ? "连接正常" : "需要配置"}</b><button onClick={() => setActive("connections")}>查看配置 →</button></footer></article>})}</div><div className="route-panel"><span>PUBLIC BACKEND ROUTE</span><code>POST /api/agents/[serviceId]/run</code><p>前台生成请求统一发送到本站后端，再由后端调用已配置的第三方模型服务。</p></div></div>}
    </section>
  </main>;
}
