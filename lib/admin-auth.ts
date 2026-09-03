const COOKIE_NAME = "lumera_admin_session";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 管理后台密码（环境变量 ADMIN_PASSWORD），未配置时返回 null 表示不启用门禁 */
export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export async function adminSessionToken(password: string): Promise<string> {
  return sha256Hex(`lumera-admin:${password}`);
}

export async function isAdminAuthorized(cookieValue: string | undefined): Promise<boolean> {
  const password = adminPassword();
  if (!password) return true; // 未配置密码时放行（本地开发）
  if (!cookieValue) return false;
  const expected = await adminSessionToken(password);
  // 常量时间比较，避免时序侧信道
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
