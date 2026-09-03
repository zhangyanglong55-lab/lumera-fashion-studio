import { readTable, writeTable, putMedia, deleteMedia } from "../../../lib/tos";

type HistoryRow = {
  id: string;
  type: string;
  stage: string;
  stageName: string;
  assetKey?: string;
  url: string;
  createdAt: string;
};

function dataUrlInfo(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("png") ? "png" : mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "bin";
  return { mime, ext, encoded: encoded || "" };
}

export async function GET() {
  const history = await readTable<HistoryRow>("generation_history");
  history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ history: history.slice(0, 120) });
}

export async function POST(request: Request) {
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
    await putMedia(assetKey, bytes, mime);
    url = `/api/video-templates/media/${encodeURIComponent(assetKey)}`;
  }

  const row: HistoryRow = {
    id,
    type,
    stage: body.stage,
    stageName: body.stageName || body.stage,
    assetKey,
    url,
    createdAt: new Date().toISOString(),
  };
  const history = await readTable<HistoryRow>("generation_history");
  history.unshift(row);
  await writeTable("generation_history", history.slice(0, 500));
  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return Response.json({ error: "缺少 ID" }, { status: 400 });
  const history = await readTable<HistoryRow>("generation_history");
  const row = history.find((item) => item.id === id);
  if (row?.assetKey) await deleteMedia(row.assetKey);
  await writeTable("generation_history", history.filter((item) => item.id !== id));
  return Response.json({ ok: true });
}
