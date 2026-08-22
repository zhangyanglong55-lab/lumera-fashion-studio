"use client";

import { useEffect, useRef, useState } from "react";
import { TestWorkspace } from "./test/page";

const services = [
  { no: "01", title: "商品净图", text: "智能识别商品主体，清理人物与复杂背景，输出平台通用的标准白底素材。", meta: "原始商品图 → 标准白底图" },
  { no: "02", title: "穿搭陈列", text: "将多件商品组合成完整造型，生成具有真实体积、层次与材质的隐形人台陈列图。", meta: "白底单品 → 完整穿搭造型" },
  { no: "03", title: "动态商拍", text: "保持人物与服装一致性，通过自然响指动作完成连续变装，生成社媒短视频。", meta: "多套造型 → 10 秒竖版视频" },
];
const slideNames = ["品牌首页", "内容流程", "效果展示", "制作中心", "关于我们"];
function SideRays({ side = "left" }: { side?: "left" | "right" }) {
  return <div className={`side-rays side-rays-${side}`} aria-hidden="true">
    {Array.from({ length: 8 }, (_, index) => <i key={index} style={{
      "--ray-blur": `${7 + index}px`,
      "--ray-opacity": String(.62 - index * .045),
      "--ray-duration": `${5.4 + index * .52}s`,
      "--ray-delay": `${index * -.62}s`,
      "--ray-left-start": `${-36 + index * 8}deg`,
      "--ray-left-end": `${-24 + index * 8}deg`,
      "--ray-right-start": `${36 - index * 8}deg`,
      "--ray-right-end": `${24 - index * 8}deg`,
    } as React.CSSProperties} />)}
  </div>;
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const storefrontRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = storefrontRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".production-section") && Math.abs(event.deltaY) > Math.abs(event.deltaX)) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      container.scrollBy({ left: event.deltaY * 1.25, behavior: "smooth" });
    };
    const onScroll = () => setCurrentSlide(Math.max(0, Math.min(slideNames.length - 1, Math.round(container.scrollLeft / window.innerWidth))));
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => { container.removeEventListener("wheel", onWheel); container.removeEventListener("scroll", onScroll); };
  }, []);
  function goToSlide(index: number) { storefrontRef.current?.scrollTo({ left: Math.max(0, Math.min(slideNames.length - 1, index)) * window.innerWidth, behavior: "smooth" }); }
  return <main className="storefront" ref={storefrontRef}>
    <header className="public-nav">
      <a className="lumera-logo" href="#top" aria-label="LUMERA 首页"><span>L</span><b>LUMERA</b><small>电商视觉工场</small></a>
      <nav className={menuOpen ? "open" : ""}><a href="#capabilities">解决方案</a><a href="#showcase">效果展示</a><a href="#studio">制作中心</a><a href="/admin">运营后台</a></nav>
      <div className="nav-actions"><a className="nav-login" href="/admin">管理入口</a><a className="nav-cta" href="#studio">开始制作 <span>↗</span></a></div>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="切换菜单">{menuOpen ? "×" : "☰"}</button>
    </header>

    <section id="top" className="commerce-hero">
      <SideRays side="right"/>
      <div className="hero-glow glow-one"/><div className="hero-glow glow-two"/>
      <div className="commerce-hero-copy">
        <span className="hero-tag"><i/> AI POWERED COMMERCE CONTENT</span>
        <h1>让每一件商品，<br/>拥有完整的<em>视觉表达。</em></h1>
        <p>从一张商品原图开始，连续完成商品净图、穿搭陈列和动态商拍。每一步都可检查、可重做、可下载。</p>
        <div className="hero-actions"><a href="#studio" className="button-light">创建新项目 <span>→</span></a><a href="#showcase" className="button-line">查看制作流程</a></div>
        <div className="trust-row"><span>适用于</span><b>服饰电商</b><b>品牌内容</b><b>社媒投放</b><b>商品上新</b></div>
      </div>
      <div className="hero-visual" aria-label="商品视觉生产流程示意">
        <div className="visual-orbit orbit-a"/><div className="visual-orbit orbit-b"/>
        <figure className="look-card look-main"><img src="/references/look-03.jpeg" alt="蓝色休闲穿搭展示"/><figcaption><span>LOOK 03</span><b>Ready for campaign</b></figcaption></figure>
        <figure className="look-card look-back"><img src="/references/look-04.jpeg" alt="米色通勤穿搭展示"/></figure>
        <div className="floating-chip chip-one"><i>✓</i><span><small>商品主体</small><b>边缘识别完成</b></span></div>
        <div className="floating-chip chip-two"><i>▶</i><span><small>动态商拍</small><b>9:16 · 10s</b></span></div>
      </div>
    </section>

    <section id="capabilities" className="capabilities-block">
      <SideRays side="left"/>
      <header><div><span className="section-label">PRODUCTION FLOW</span><h2>一条真正可控的<br/>电商内容生产线</h2></div><p>不是一次性黑盒生成。每完成一个环节，先检查结果；确认满意后，再进入下一步。</p></header>
      <div className="service-grid">{services.map((item) => <article key={item.no}><div className="service-number">{item.no}</div><div className="service-icon">{item.no === "01" ? "◐" : item.no === "02" ? "◇" : "▶"}</div><h3>{item.title}</h3><p>{item.text}</p><footer>{item.meta}<span>↗</span></footer></article>)}</div>
    </section>

    <section id="showcase" className="showcase-block">
      <SideRays side="right"/>
      <div className="showcase-copy"><span className="section-label">CONSISTENT OUTPUT</span><h2>从静态商品，<br/>到可投放的动态内容。</h2><p>统一的商品颜色、材质和造型语言，贯穿白底图、穿搭图与视频，减少反复修图和跨团队沟通。</p><div className="proof-list"><span><b>01</b>商品颜色与材质保真</span><span><b>02</b>穿搭比例与配件完整</span><span><b>03</b>人物身份与动作连续</span></div></div>
      <div className="showcase-gallery">{[1,2,4,5].map((n, index) => <figure key={n} className={`gallery-${index + 1}`}><img src={`/references/look-0${n}.jpeg`} alt={`电商穿搭效果 ${n}`}/><figcaption>LOOK / 0{n}</figcaption></figure>)}</div>
    </section>

    <section id="studio" className="production-section">
      <SideRays side="left"/>
      <header className="production-heading"><span className="section-label">CONTENT STUDIO</span><h2>开始创建商品视觉</h2><p>上传商品图，按照三个步骤逐项生成并确认结果。</p></header>
      <TestWorkspace embedded />
    </section>

    <footer className="public-footer"><SideRays side="right"/><a className="lumera-logo" href="#top"><span>L</span><b>LUMERA</b></a><p>让商品内容生产，更快、更稳、更一致。</p><div><a href="#studio">制作中心</a><a href="/admin">运营后台</a></div><small>© 2026 LUMERA Commerce Content Studio</small></footer>
    <aside className="horizontal-guide" aria-label="横向页面导航"><button onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} aria-label="上一页">←</button><div className="guide-status"><span>{String(currentSlide + 1).padStart(2,"0")} / {String(slideNames.length).padStart(2,"0")}</span><b>{slideNames[currentSlide]}</b><small>左右滑动浏览</small></div><div className="guide-dots">{slideNames.map((name,index) => <button key={name} className={index === currentSlide ? "active" : ""} onClick={() => goToSlide(index)} aria-label={`前往${name}`}/>)}</div><button onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slideNames.length - 1} aria-label="下一页">→</button></aside>
  </main>;
}
