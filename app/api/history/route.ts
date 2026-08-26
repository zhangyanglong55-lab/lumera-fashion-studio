import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; TEMPLATE_MEDIA: R2Bucket };
const bindings = env as unknown as Bindings;

async function ensureTable() {
  await bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS generation_history (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    stage TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    asset_key TEXT,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
}

function present(row: Record<string, unknown>) {
  return { ...row, stageName: row.stage_name, assetKey: row.asset_key, createdAt: row.created_at };
}

function dataUrlInfo(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("png") ? "png" : mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "bin";
  return { mime, ext, encoded: encoded || "" };
}

export async function GET() {
  await ensureTable();
  const result = await bindings.DB.prepare("SELECT * FROM generation_history ORDER BY created_at DESC LIMIT 120").all();
  return Response.json({ history: result.results.map((row: Record<string, unknown>) => present(row)) });
}

export async function POST(request: Request) {
  await ensureTable();
  const body = await request.json().catch(() => null) as null | { type?: string; stage?: string; stageName?: string; url?: string };
  if (!body?.type || !body?.stage || !body?.url) return Response.json({ error: "缺少 type / stage / url 参数" }, { status: 400 });

  const id = crypto.randomUUID();
  const type = body.type === "video" ? "video" : "image";
  let url = body.url;
  let assetKey = "";

  if (body.url.startsWith("data:")) {
    const { mime, ext, encoded } = dataUrlInfo(body.url);
    if (!encoded) return Response.json({ error: "无效的 data URL" }, { status: 400 });
    assetKey = `history/${id}.${ext}`;
    const bytes = Buffer.from(encoded, "base64");
    await bindings.TEMPLATE_MEDIA.put(assetKey, bytes, { httpMetadata: { contentType: mime } });
    url = `/api/video-templates/media/${encodeURIComponent(assetKey)}`;
  }

  await bindings.DB.prepare(`INSERT INTO generation_history (id, type, stage, stage_name, asset_key, url, created_at)
    VALUES (?,?,?,?,?,?,?)`)
    .bind(id, type, body.stage, body.stageName || body.stage, assetKey, url, new Date().toISOString()).run();

  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  await ensureTable();
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return Response.json({ error: "缺少 ID" }, { status: 400 });
  const row = await bindings.DB.prepare("SELECT asset_key FROM generation_history WHERE id = ?").bind(id).first<Record<string, unknown>>();
  await bindings.DB.prepare("DELETE FROM generation_history WHERE id = ?").bind(id).run();
  if (row?.asset_key) await bindings.TEMPLATE_MEDIA.delete(String(row.asset_key));
  return Response.json({ ok: true });
}
