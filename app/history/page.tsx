"use client";

import { useEffect, useState } from "react";

type HistoryItem = { id: string; type: string; stage: string; stageName: string; url: string; createdAt: string };

const stageColors: Record<string, string> = {
  "product-white-bg": "#78a7ff",
  "hollow-look": "#c792ff",
  "snap-change-video": "#51ddb5",
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      setItems(data.history || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(id: string) {
    if (!window.confirm("确定删除这条生成记录吗？")) return;
    await fetch("/api/history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return <main className="history-page">
    <header className="history-topbar">
      <a className="history-brand" href="/"><span>L</span><b>LUMERA</b><small>生成历史</small></a>
      <div className="history-actions"><span>{items.length} 条记录</span><button type="button" onClick={refresh}>刷新</button><a href="/studio">去制作 ↗</a></div>
    </header>
    <section className="history-content">
      <div className="history-head"><h1>历史生成记录</h1><p>这里保存你在工作台生成过的图片和视频，可随时下载或删除。</p></div>
      {loading ? <p className="history-empty">加载中……</p> : items.length === 0 ? <p className="history-empty">还没有生成记录，去工作台生成第一张图吧。</p> : <div className="history-grid">{items.map((item) => {
        const date = new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false });
        return <article className="history-card" key={item.id}>
          <div className="history-media">{item.type === "video" ? <video src={item.url} controls playsInline preload="metadata"/> : <img src={item.url} alt={item.stageName} loading="lazy"/>}<span className="history-type" style={{ background: stageColors[item.stage] || "#889085" }}>{item.type === "video" ? "视频" : "图片"}</span></div>
          <div className="history-meta"><div><b>{item.stageName}</b><small>{date}</small></div><div className="history-card-actions"><a href={item.url} download>下载</a><button type="button" onClick={() => remove(item.id)}>删除</button></div></div>
        </article>;
      })}</div>}
    </section>
  </main>;
}
