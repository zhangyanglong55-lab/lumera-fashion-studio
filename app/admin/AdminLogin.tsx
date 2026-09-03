"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(false);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (response.ok) {
      window.location.reload();
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "radial-gradient(1200px 600px at 50% -10%, #1d1d22, #0b0b0d)", color: "#eaeaea", fontFamily: "system-ui, -apple-system, 'PingFang SC', sans-serif", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "32px 28px", backdropFilter: "blur(12px)" }}>
        <div style={{ marginBottom: 26 }}>
          <span style={{ fontSize: 12, letterSpacing: 2, color: "#d5ff45", textTransform: "uppercase" }}>LUMERA · Admin</span>
          <h1 style={{ fontSize: 24, margin: "8px 0 4px", fontWeight: 700 }}>管理后台</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9a9aa3" }}>请输入密码进入内容生产系统</p>
        </div>
        <label style={{ display: "block", marginBottom: 18 }}>
          <span style={{ display: "block", fontSize: 12, color: "#9a9aa3", marginBottom: 8 }}>访问密码</span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入管理密码"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none" }}
          />
        </label>
        {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "0 0 14px" }}>密码错误，请重试</p>}
        <button type="submit" disabled={loading || !password} style={{ width: "100%", background: "#d5ff45", color: "#111", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: loading || !password ? "not-allowed" : "pointer", opacity: loading || !password ? 0.5 : 1 }}>
          {loading ? "验证中…" : "进入后台"}
        </button>
      </form>
    </main>
  );
}
