import { readTable, writeTable, putMedia, deleteMedia } from "../../../lib/tos";

type VideoTemplate = {
  id: string;
  code: string;
  name: string;
  description: string;
  prompt: string;
  previewUrl?: string;
  previewKey?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
};

export async function GET() {
  const templates = await readTable<VideoTemplate>("video_templates");
  templates.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  return Response.json({ templates });
}

export async function POST(request: Request) {
  const templates = await readTable<VideoTemplate>("video_templates");
  const form = await request.formData();
  const id = String(form.get("id") || crypto.randomUUID());
  const existing = templates.find((item) => item.id === id);

  let previewUrl = String(form.get("previewUrl") || existing?.previewUrl || "");
  let previewKey = String(existing?.previewKey || "");

  const file = form.get("file");
  if (file instanceof File && file.size) {
    if (!file.type.startsWith("video/")) return Response.json({ error: "仅支持视频文件" }, { status: 400 });
    const previousKey = previewKey;
    const key = `video-templates/${id}-${Date.now()}.${file.name.split(".").pop() || "mp4"}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await putMedia(key, bytes, file.type || "video/mp4");
    previewUrl = `/api/video-templates/media/${encodeURIComponent(key)}`;
    previewKey = key;
    if (previousKey && previousKey !== key) await deleteMedia(previousKey);
  }

  const template: VideoTemplate = {
    id,
    code: String(form.get("code") || "NEW"),
    name: String(form.get("name") || "未命名模板"),
    description: String(form.get("description") || ""),
    prompt: String(form.get("prompt") || ""),
    previewUrl,
    previewKey,
    enabled: form.get("enabled") !== "false",
    sortOrder: Number(form.get("sortOrder") || 99),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  const next = existing
    ? templates.map((item) => (item.id === id ? template : item))
    : [...templates, template];
  await writeTable("video_templates", next);
  return Response.json({ template });
}

export async function DELETE(request: Request) {
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return Response.json({ error: "缺少模板 ID" }, { status: 400 });
  const templates = await readTable<VideoTemplate>("video_templates");
  const row = templates.find((item) => item.id === id);
  if (row?.previewKey) await deleteMedia(row.previewKey);
  await writeTable("video_templates", templates.filter((item) => item.id !== id));
  return Response.json({ ok: true });
}
