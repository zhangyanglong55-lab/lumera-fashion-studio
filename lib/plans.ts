export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  whiteQuota: number;   // 白底图（商品净图）额度，-1 表示不限次数
  hollowQuota: number;  // 真人穿搭额度，-1 表示不限次数
  videoQuota: number;   // 视频额度，-1 表示不限次数
  desc: string;
  popular?: boolean;
  features: string[];
};

export type Subscription = {
  plan: string;
  whiteQuota: number;
  hollowQuota: number;
  videoQuota: number;
};

export const defaultPlans: SubscriptionPlan[] = [
  { id: "free", name: "基础版", price: "免费", period: "", whiteQuota: 5, hollowQuota: 3, videoQuota: 0, desc: "免费体验", features: ["白底图 5 次", "真人穿搭 3 次", "不包含视频生成"] },
  { id: "glimmer", name: "微光版", price: "¥19.9", period: "/周", whiteQuota: -1, hollowQuota: -1, videoQuota: 30, desc: "小试牛刀", features: ["白底图与真人穿搭不限次数", "每周 30 次视频生成", "全部视频模板"] },
  { id: "illuminate", name: "烛照版", price: "¥39.9", period: "/月", whiteQuota: -1, hollowQuota: -1, videoQuota: 100, desc: "解锁全部功能", popular: true, features: ["白底图与真人穿搭不限次数", "每月 100 次视频生成", "全部模板 + 历史记录"] },
  { id: "insight", name: "洞见版", price: "¥99.9", period: "/月", whiteQuota: -1, hollowQuota: -1, videoQuota: 300, desc: "专业创作", features: ["白底图与真人穿搭不限次数", "每月 300 次视频生成", "优先处理"] },
];

export function defaultSubscription(): Subscription {
  const free = defaultPlans.find((p) => p.id === "free") || defaultPlans[0];
  return { plan: "free", whiteQuota: free.whiteQuota, hollowQuota: free.hollowQuota, videoQuota: free.videoQuota };
}

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
