import { cookies } from "next/headers";
import { adminPassword, adminSessionToken, ADMIN_COOKIE_NAME } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  const expected = adminPassword();
  if (!expected) return Response.json({ error: "管理后台未配置密码，无需登录" }, { status: 400 });

  const body = await request.json().catch(() => null) as null | { password?: string };
  const password = body?.password;
  if (typeof password !== "string" || password !== expected) {
    return Response.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await adminSessionToken(expected);
  (await cookies()).set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(ADMIN_COOKIE_NAME);
  return Response.json({ ok: true });
}
