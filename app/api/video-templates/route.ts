import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; TEMPLATE_MEDIA: R2Bucket };
const bindings = env as unknown as Bindings;

async function ensureTable() {
  await bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS video_templates (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    preview_url TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`).run();
}

export async function GET() {
  await ensureTable();
  const result = await bindings.DB.prepare("SELECT * FROM video_templates ORDER BY sort_order ASC, created_at ASC").all();
  return Response.json({ templates: result.results.map((row: Record<string, unknown>) => ({ ...row, previewUrl: row.preview_url, sortOrder: row.sort_order, createdAt: row.created_at, enabled: Boolean(row.enabled) })) });
}

export async function POST(request: Request) {
  await ensureTable();
  const form = await request.formData();
  const id = String(form.get("id") || crypto.randomUUID());
  const file = form.get("file");
  let previewUrl = String(form.get("previewUrl") || "");
  if (file instanceof File && file.size) {
    if (!file.type.startsWith("video/")) return Response.json({ error: "仅支持视频文件" }, { status: 400 });
    const key = `video-templates/${id}-${Date.now()}.${file.name.split(".").pop() || "mp4"}`;
    await bindings.TEMPLATE_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type || "video/mp4" } });
    previewUrl = `/api/video-templates/media/${encodeURIComponent(key)}`;
  }
  const values = {
    id, code: String(form.get("code") || "NEW"), name: String(form.get("name") || "未命名模板"),
    description: String(form.get("description") || ""), prompt: String(form.get("prompt") || ""), previewUrl,
    enabled: form.get("enabled") === "false" ? 0 : 1, sortOrder: Number(form.get("sortOrder") || 99), createdAt: new Date().toISOString(),
  };
  await bindings.DB.prepare(`INSERT INTO video_templates (id,code,name,description,prompt,preview_url,enabled,sort_order,created_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,description=excluded.description,prompt=excluded.prompt,preview_url=excluded.preview_url,enabled=excluded.enabled,sort_order=excluded.sort_order`)
    .bind(values.id, values.code, values.name, values.description, values.prompt, values.previewUrl, values.enabled, values.sortOrder, values.createdAt).run();
  return Response.json({ template: { ...values, enabled: Boolean(values.enabled) } });
}
