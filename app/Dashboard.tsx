"use client";

import { useEffect, useRef, useState } from "react";
import { TestWorkspace } from "./test/page";

const services = [
  { no: "01", title: "商品净图", text: "智能识别商品主体，清理人物与复杂背景，输出平台通用的标准白底素材。", meta: "原始商品图 → 标准白底图" },
  { no: "02", title: "穿搭陈列", text: "将多件商品组合成完整造型，生成具有真实体积、层次与材质的隐形人台陈列图。", meta: "白底单品 → 完整穿搭造型" },
  { no: "03", title: "动态商拍", text: "保持人物与服装一致性，通过自然响指动作完成连续变装，生成社媒短视频。", meta: "多套造型 → 10 秒竖版视频" },
];
type PromptVideo = { id: string; title: string; category: string; description: string; prompt: string; videoUrl?: string; posterUrl?: string; enabled: boolean; sortOrder: number };
const slideNames = ["品牌首页", "内容流程", "效果展示", "视频灵感", "制作中心", "关于我们"];
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

function BallpitBackdrop({ scrollRef }: { scrollRef: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const host = canvas.parentElement;
    if (!host) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = ["#d7ff44", "#183522", "#111713", "#e9ece4"];
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 1;
    let height = 1;
    let frame = 0;
    let dpr = 1;
    let lastScrollLeft = scrollRef.current?.scrollLeft || 0;
    let scrollImpulse = 0;
    let balls: Array<{ x: number; y: number; vx: number; vy: number; radius: number; color: string; mass: number; response: number; damping: number }> = [];

    const createBalls = () => {
      const count = width < 700 ? 12 : 24;
      balls = Array.from({ length: count }, (_, index) => {
        const radius = (width < 700 ? 18 : 25) + Math.random() * (width < 700 ? 18 : 32);
        const edge = index % 3 === 0;
        const group = index % 10;
        const response = group < 3 ? .025 + Math.random() * .035 : group < 7 ? .22 + Math.random() * .2 : .62 + Math.random() * .28;
        return {
          x: edge ? (index % 2 ? radius + Math.random() * width * .18 : width - radius - Math.random() * width * .18) : radius + Math.random() * (width - radius * 2),
          y: height * (.52 + Math.random() * .38),
          vx: (Math.random() - .5) * .55 * (.35 + response),
          vy: (Math.random() - .5) * .35,
          radius,
          color: palette[index % palette.length],
          mass: radius * radius,
          response,
          damping: .987 + Math.random() * .009,
        };
      });
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createBalls();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
    };
    const onHorizontalScroll = () => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const delta = scroller.scrollLeft - lastScrollLeft;
      lastScrollLeft = scroller.scrollLeft;
      scrollImpulse = Math.max(-3.2, Math.min(3.2, scrollImpulse * .45 + delta * .035));
      const progress = scroller.scrollLeft / Math.max(1, window.innerWidth);
      const levels = [.78, .22, .12, .18, 0, 1];
      const left = Math.max(0, Math.min(levels.length - 1, Math.floor(progress)));
      const right = Math.min(levels.length - 1, left + 1);
      const mix = Math.max(0, Math.min(1, progress - left));
      canvas.style.opacity = String(levels[left] * (1 - mix) + levels[right] * mix);
    };
    const drawBall = (ball: (typeof balls)[number]) => {
      const gradient = context.createRadialGradient(ball.x - ball.radius * .32, ball.y - ball.radius * .38, ball.radius * .08, ball.x, ball.y, ball.radius);
      gradient.addColorStop(0, ball.color === "#111713" ? "#637067" : "#ffffff");
      gradient.addColorStop(.16, ball.color);
      gradient.addColorStop(.72, ball.color);
      gradient.addColorStop(1, "#050706");
      context.beginPath();
      context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = ball.color === "#d7ff44" ? "rgba(215,255,68,.55)" : "rgba(255,255,255,.12)";
      context.lineWidth = 1;
      context.stroke();
    };
    const animate = () => {
      context.clearRect(0, 0, width, height);
      for (let i = 0; i < balls.length; i += 1) {
        const ball = balls[i];
        if (!reducedMotion) {
          ball.vx += scrollImpulse * .062 * ball.response * Math.min(1.25, 1800 / ball.mass);
          ball.vy += .018;
          if (pointer.active) {
            const dx = ball.x - pointer.x;
            const dy = ball.y - pointer.y;
            const distance = Math.hypot(dx, dy) || 1;
            const reach = ball.radius + 115;
            if (distance < reach) {
              const force = (reach - distance) / reach;
              ball.vx += (dx / distance) * force * .32;
              ball.vy += (dy / distance) * force * .32;
            }
          }
          ball.x += ball.vx;
          ball.y += ball.vy;
          ball.vx *= ball.damping;
          ball.vy *= .995;
          if (ball.x - ball.radius < 0 || ball.x + ball.radius > width) {
            ball.x = Math.max(ball.radius, Math.min(width - ball.radius, ball.x));
            ball.vx *= -.76;
          }
          if (ball.y + ball.radius > height - 4) {
            ball.y = height - ball.radius - 4;
            ball.vy *= -.68;
            ball.vx += (Math.random() - .5) * .025;
            ball.vx *= .975;
          }
          if (ball.y - ball.radius < height * .37) {
            ball.y = height * .37 + ball.radius;
            ball.vy = Math.abs(ball.vy) * .7;
          }
          for (let j = i + 1; j < balls.length; j += 1) {
            const other = balls[j];
            const dx = other.x - ball.x;
            const dy = other.y - ball.y;
            const distance = Math.hypot(dx, dy) || 1;
            const minimum = ball.radius + other.radius;
            if (distance < minimum) {
              const overlap = (minimum - distance) * .5;
              const nx = dx / distance;
              const ny = dy / distance;
              ball.x -= nx * overlap;
              ball.y -= ny * overlap;
              other.x += nx * overlap;
              other.y += ny * overlap;
              const impulse = (other.vx - ball.vx) * nx + (other.vy - ball.vy) * ny;
              if (impulse < 0) {
                ball.vx += impulse * nx * .48;
                ball.vy += impulse * ny * .48;
                other.vx -= impulse * nx * .48;
                other.vy -= impulse * ny * .48;
              }
            }
          }
        }
        drawBall(ball);
      }
      scrollImpulse *= .86;
      if (!reducedMotion) frame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    scrollRef.current?.addEventListener("scroll", onHorizontalScroll, { passive: true });
    resize();
    onHorizontalScroll();
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      scrollRef.current?.removeEventListener("scroll", onHorizontalScroll);
    };
  }, [scrollRef]);
  return <canvas ref={canvasRef} className="ballpit-backdrop global-ballpit" aria-hidden="true" />;
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [promptVideos, setPromptVideos] = useState<PromptVideo[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptVideo | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState("");
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
  useEffect(() => {
    fetch("/api/prompt-videos").then(response => response.ok ? response.json() : Promise.reject()).then(data => setPromptVideos(data.videos || [])).catch(() => setPromptVideos([]));
  }, []);
  function goToSlide(index: number) { storefrontRef.current?.scrollTo({ left: Math.max(0, Math.min(slideNames.length - 1, index)) * window.innerWidth, behavior: "smooth" }); }
  async function copyPrompt(video: PromptVideo) {
    try { await navigator.clipboard.writeText(video.prompt); }
    catch {
      const textarea = document.createElement("textarea"); textarea.value = video.prompt; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
    }
    setCopiedPrompt(video.id); setTimeout(() => setCopiedPrompt(""), 1800);
  }
  const gallerySlots = Array.from({ length: 6 }, (_, index) => promptVideos[index] || null);
  return <main className="storefront" ref={storefrontRef}>
    <header className="public-nav">
      <a className="lumera-logo" href="#top" aria-label="LUMERA 首页"><span>L</span><b>LUMERA</b><small>电商视觉工场</small></a>
      <nav className={menuOpen ? "open" : ""}><a href="#capabilities">解决方案</a><a href="#showcase">效果展示</a><a href="#video-gallery">视频灵感</a><a href="#studio">制作中心</a><a href="/admin">运营后台</a></nav>
      <div className="nav-actions"><a className="nav-login" href="/admin">管理入口</a><a className="nav-cta" href="#studio">开始制作 <span>↗</span></a></div>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="切换菜单">{menuOpen ? "×" : "☰"}</button>
    </header>
    <BallpitBackdrop scrollRef={storefrontRef}/>

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

    <section id="video-gallery" className="video-gallery-section">
      <SideRays side="left"/>
      <header><div><span className="section-label">VIDEO PROMPT GALLERY</span><h2>从一个提示词，<br/>找到下一条视频灵感。</h2></div><p>观看案例、打开完整提示词，或直接一键复制到你的生成工具中使用。</p></header>
      <div className="video-prompt-grid">{gallerySlots.map((video, index) => video ? <article className={`video-prompt-card card-depth-${index % 3}`} key={video.id}>
        <div className="video-frame">{video.videoUrl ? <video src={video.videoUrl} poster={video.posterUrl} muted loop autoPlay playsInline preload="metadata"/> : <div className="video-placeholder"><span>▶</span></div>}<span className="video-index">0{index + 1}</span><b>{video.category}</b></div>
        <div className="video-card-copy"><div><h3>{video.title}</h3><p>{video.description}</p></div><div className="video-card-actions"><button onClick={() => setSelectedPrompt(video)}>查看提示词</button><button className="copy-prompt-button" onClick={() => copyPrompt(video)}>{copiedPrompt === video.id ? "已复制 ✓" : "复制完整提示词"}</button></div></div>
      </article> : <article className={`video-prompt-card video-prompt-empty card-depth-${index % 3}`} key={`empty-${index}`}><div className="video-frame"><div className="video-placeholder"><span>＋</span><small>COMING SOON</small></div><span className="video-index">0{index + 1}</span></div><div className="video-card-copy"><div><h3>待发布视频模板</h3><p>运营后台上传视频与提示词后将在这里展示。</p></div></div></article>)}</div>
    </section>

    <section id="studio" className="production-section">
      <SideRays side="left"/>
      <header className="production-heading"><span className="section-label">CONTENT STUDIO</span><h2>开始创建商品视觉</h2><p>上传商品图，按照三个步骤逐项生成并确认结果。</p></header>
      <TestWorkspace embedded />
    </section>

    <footer className="public-footer footer-ballpit"><SideRays side="right"/><div className="footer-ballpit-copy"><span className="section-label">COMMERCE CONTENT, IN MOTION</span><a className="lumera-logo" href="#top"><span>L</span><b>LUMERA</b></a><h2>让商品内容生产，<br/>更快、更稳、<em>更一致。</em></h2><p>从第一张商品图，到每一次品牌表达。</p><div className="footer-actions"><a href="#studio">开始制作 <span>↗</span></a><a href="/admin">进入运营后台</a></div></div><small>© 2026 LUMERA Commerce Content Studio</small></footer>
    {selectedPrompt && <div className="prompt-dialog-backdrop" role="presentation" onClick={() => setSelectedPrompt(null)}><section className="prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="prompt-dialog-title" onClick={event => event.stopPropagation()}><header><span>{selectedPrompt.category}</span><button onClick={() => setSelectedPrompt(null)} aria-label="关闭提示词">×</button></header><h2 id="prompt-dialog-title">{selectedPrompt.title}</h2><p>{selectedPrompt.description}</p><div className="prompt-dialog-content">{selectedPrompt.prompt}</div><footer><span>{selectedPrompt.prompt.length} 字符 · 完整提示词</span><button onClick={() => copyPrompt(selectedPrompt)}>{copiedPrompt === selectedPrompt.id ? "已复制完整提示词 ✓" : "复制全部提示词"}</button></footer></section></div>}
    <aside className="horizontal-guide" aria-label="横向页面导航"><button onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} aria-label="上一页">←</button><div className="guide-status"><span>{String(currentSlide + 1).padStart(2,"0")} / {String(slideNames.length).padStart(2,"0")}</span><b>{slideNames[currentSlide]}</b><small>左右滑动浏览</small></div><div className="guide-dots">{slideNames.map((name,index) => <button key={name} className={index === currentSlide ? "active" : ""} onClick={() => goToSlide(index)} aria-label={`前往${name}`}/>)}</div><button onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slideNames.length - 1} aria-label="下一页">→</button></aside>
  </main>;
}
