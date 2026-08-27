"use client";

import { useState } from "react";
import { loadPlans, type SubscriptionPlan } from "../../lib/plans";

export default function PricingPage() {
  const [plans] = useState<SubscriptionPlan[]>(loadPlans());
  const [message, setMessage] = useState("");

  function subscribe(plan: SubscriptionPlan) {
    window.localStorage.setItem("lumera-subscription", JSON.stringify({ plan: plan.id, quota: plan.quota }));
    setMessage(`已订阅「${plan.name}」，获得 ${plan.quota} 次视频生成额度，现在可以去制作中心生成视频了。`);
  }

  return <main className="pricing-page">
    <header className="pricing-topbar">
      <a className="pricing-brand" href="/"><span>L</span><b>LUMERA</b><small>订阅价格</small></a>
      <div className="pricing-nav"><a href="/">首页</a><a href="/studio">制作中心</a><a href="/history">历史记录</a><a href="/admin">运营后台</a></div>
    </header>
    <section className="pricing-hero">
      <span>MEMBERSHIP PLANS</span>
      <h1>选择适合你的<br/>创作方案</h1>
      <p>商品净图和真人穿搭免费使用，生成换装视频需要订阅额度。</p>
    </section>
    <section className="pricing-content">
      <div className="pricing-plans">{plans.map((plan) => <article key={plan.id} className={plan.popular ? "popular" : ""}>{plan.popular && <span className="popular-badge">最受欢迎</span>}<h3>{plan.name}</h3><div className="plan-price">{plan.price}<small>{plan.period}</small></div><p>{plan.desc}</p><ul>{plan.features.map((feature, i) => <li key={i}>✓ {feature}</li>)}</ul><button onClick={() => subscribe(plan)}>{plan.id === "free" ? "继续免费" : "立即订阅"}</button></article>)}</div>
      {message && <div className="pricing-message">{message}</div>}
    </section>
  </main>;
}
