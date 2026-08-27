export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  quota: number;
  desc: string;
  popular?: boolean;
  features: string[];
};

export const defaultPlans: SubscriptionPlan[] = [
  { id: "free", name: "基础版", price: "免费", period: "", quota: 0, desc: "无视频生成额度", features: ["商品净图与真人穿搭", "不包含视频生成", "需订阅后才能生成视频"] },
  { id: "glimmer", name: "微光版", price: "¥19.9", period: "/周", quota: 30, desc: "小试牛刀", features: ["全部功能", "每周 30 次视频生成", "全部视频模板"] },
  { id: "illuminate", name: "烛照版", price: "¥39.9", period: "/月", quota: 100, desc: "解锁全部功能", popular: true, features: ["全部功能", "每月 100 次视频生成", "全部模板 + 历史记录"] },
  { id: "insight", name: "洞见版", price: "¥99.9", period: "/月", quota: 300, desc: "专业创作", features: ["全部功能", "每月 300 次视频生成", "优先处理"] },
];

export function loadPlans(): SubscriptionPlan[] {
  if (typeof window === "undefined") return defaultPlans;
  try {
    const saved = JSON.parse(window.localStorage.getItem("lumera-plans") || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* ignore */ }
  return defaultPlans;
}

export function savePlans(plans: SubscriptionPlan[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lumera-plans", JSON.stringify(plans));
}
