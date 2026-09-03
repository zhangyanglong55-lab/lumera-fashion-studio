// Next.js standalone 部署准备：把 public 静态资源和 .next/static 复制进 standalone 目录。
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";

if (existsSync("public")) {
  cpSync("public", `${standalone}/public`, { recursive: true });
  console.log("[standalone] public/ 已复制");
}

if (existsSync(".next/static")) {
  cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
  console.log("[standalone] .next/static 已复制");
}

console.log("[standalone] 准备完成 ->", standalone);
