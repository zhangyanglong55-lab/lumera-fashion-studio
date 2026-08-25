import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; TEMPLATE_MEDIA: R2Bucket };
const bindings = env as unknown as Bindings;

async function ensureTable() {
  await bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS prompt_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    video_url TEXT,
    video_key TEXT,
    poster_url TEXT,
    poster_key TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await bindings.DB.prepare("CREATE INDEX IF NOT EXISTS idx_prompt_videos_enabled_sort ON prompt_videos(enabled, sort_order)").run();
  try {
    await bindings.DB.prepare("ALTER TABLE prompt_videos ADD COLUMN code TEXT NOT NULL DEFAULT ''").run();
  } catch {
    // 列已存在
  }
}

function present(row: Record<string, unknown>) {
  return { ...row, videoUrl: row.video_url, posterUrl: row.poster_url, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at, enabled: Boolean(row.enabled) };
}

export async function GET(request: Request) {
  await ensureTable();
  const all = new URL(request.url).searchParams.get("all") === "1";
  const query = all
    ? "SELECT * FROM prompt_videos ORDER BY sort_order ASC, created_at ASC"
    : "SELECT * FROM prompt_videos WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC LIMIT 6";
  const result = await bindings.DB.prepare(query).all();
  return Response.json({ videos: result.results.map((row: Record<string, unknown>) => present(row)) });
}

async function storeFile(file: File, id: string, kind: "video" | "poster") {
  const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
  const key = `prompt-videos/${id}-${kind}-${Date.now()}.${ext}`;
  await bindings.TEMPLATE_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return { key, url: `/api/video-templates/media/${encodeURIComponent(key)}` };
}

export async function POST(request: Request) {
  await ensureTable();
  const form = await request.formData();
  const id = String(form.get("id") || crypto.randomUUID());
  const existing = await bindings.DB.prepare("SELECT * FROM prompt_videos WHERE id = ?").bind(id).first<Record<string, unknown>>();
  let videoUrl = String(form.get("videoUrl") || existing?.video_url || "");
  let videoKey = String(existing?.video_key || "");
  let posterUrl = String(form.get("posterUrl") || existing?.poster_url || "");
  let posterKey = String(existing?.poster_key || "");
  const video = form.get("video");
  const poster = form.get("poster");
  if (video instanceof File && video.size) {
    if (!video.type.startsWith("video/")) return Response.json({ error: "视频文件格式不正确" }, { status: 400 });
    const previousKey = videoKey;
    const stored = await storeFile(video, id, "video"); videoUrl = stored.url; videoKey = stored.key;
    if (previousKey && previousKey !== stored.key) await bindings.TEMPLATE_MEDIA.delete(previousKey);
  }
  if (poster instanceof File && poster.size) {
    if (!poster.type.startsWith("image/")) return Response.json({ error: "封面文件格式不正确" }, { status: 400 });
    const previousKey = posterKey;
    const stored = await storeFile(poster, id, "poster"); posterUrl = stored.url; posterKey = stored.key;
    if (previousKey && previousKey !== stored.key) await bindings.TEMPLATE_MEDIA.delete(previousKey);
  }
  const now = new Date().toISOString();
  const values = {
    id,
    title: String(form.get("title") || "未命名视频"),
    code: String(form.get("code") || ""),
    category: String(form.get("category") || "视频灵感"),
    description: String(form.get("description") || ""),
    prompt: String(form.get("prompt") || ""),
    videoUrl, videoKey, posterUrl, posterKey,
    enabled: form.get("enabled") === "false" ? 0 : 1,
    sortOrder: Number(form.get("sortOrder") || 99),
    createdAt: String(existing?.created_at || now), updatedAt: now,
  };
  await bindings.DB.prepare(`INSERT INTO prompt_videos (id,title,code,category,description,prompt,video_url,video_key,poster_url,poster_key,enabled,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,code=excluded.code,category=excluded.category,description=excluded.description,prompt=excluded.prompt,video_url=excluded.video_url,video_key=excluded.video_key,poster_url=excluded.poster_url,poster_key=excluded.poster_key,enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=excluded.updated_at`)
    .bind(values.id, values.title, values.code, values.category, values.description, values.prompt, values.videoUrl, values.videoKey, values.posterUrl, values.posterKey, values.enabled, values.sortOrder, values.createdAt, values.updatedAt).run();
  return Response.json({ video: { ...values, enabled: Boolean(values.enabled) } });
}

export async function DELETE(request: Request) {
  await ensureTable();
  const { id } = await request.json() as { id?: string };
  if (!id) return Response.json({ error: "缺少视频 ID" }, { status: 400 });
  const row = await bindings.DB.prepare("SELECT video_key, poster_key FROM prompt_videos WHERE id = ?").bind(id).first<Record<string, string>>();
  await bindings.DB.prepare("DELETE FROM prompt_videos WHERE id = ?").bind(id).run();
  if (row?.video_key) await bindings.TEMPLATE_MEDIA.delete(row.video_key);
  if (row?.poster_key) await bindings.TEMPLATE_MEDIA.delete(row.poster_key);
  return Response.json({ ok: true });
}
