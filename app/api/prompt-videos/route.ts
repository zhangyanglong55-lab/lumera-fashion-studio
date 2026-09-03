import { readTable, writeTable, putMedia, deleteMedia } from "../../../lib/tos";

type PromptVideo = {
  id: string;
  title: string;
  code: string;
  category: string;
  description: string;
  prompt: string;
  lookCount: number;
  videoUrl?: string;
  videoKey?: string;
  posterUrl?: string;
  posterKey?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function GET(request: Request) {
  const videos = await readTable<PromptVideo>("prompt_videos");
  const all = new URL(request.url).searchParams.get("all") === "1";
  const filtered = all ? videos : videos.filter((video) => video.enabled);
  filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const result = all ? filtered : filtered.slice(0, 6);
  return Response.json({ videos: result });
}

async function storeFile(file: File, id: string, kind: "video" | "poster") {
  const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
  const key = `prompt-videos/${id}-${kind}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await putMedia(key, bytes, file.type);
  return { key, url: `/api/video-templates/media/${encodeURIComponent(key)}` };
}

export async function POST(request: Request) {
  const videos = await readTable<PromptVideo>("prompt_videos");
  const form = await request.formData();
  const id = String(form.get("id") || crypto.randomUUID());
  const existing = videos.find((video) => video.id === id);

  let videoUrl = String(form.get("videoUrl") || existing?.videoUrl || "");
  let videoKey = String(existing?.videoKey || "");
  let posterUrl = String(form.get("posterUrl") || existing?.posterUrl || "");
  let posterKey = String(existing?.posterKey || "");

  const video = form.get("video");
  const poster = form.get("poster");

  if (video instanceof File && video.size) {
    if (!video.type.startsWith("video/")) return Response.json({ error: "视频文件格式不正确" }, { status: 400 });
    const previousKey = videoKey;
    const stored = await storeFile(video, id, "video");
    videoUrl = stored.url;
    videoKey = stored.key;
    if (previousKey && previousKey !== stored.key) await deleteMedia(previousKey);
  }
  if (poster instanceof File && poster.size) {
    if (!poster.type.startsWith("image/")) return Response.json({ error: "封面文件格式不正确" }, { status: 400 });
    const previousKey = posterKey;
    const stored = await storeFile(poster, id, "poster");
    posterUrl = stored.url;
    posterKey = stored.key;
    if (previousKey && previousKey !== stored.key) await deleteMedia(previousKey);
  }

  const now = new Date().toISOString();
  const record: PromptVideo = {
    id,
    title: String(form.get("title") || "未命名视频"),
    code: String(form.get("code") || ""),
    category: String(form.get("category") || "视频灵感"),
    description: String(form.get("description") || ""),
    prompt: String(form.get("prompt") || ""),
    lookCount: Number(form.get("lookCount") || 5),
    videoUrl,
    videoKey,
    posterUrl,
    posterKey,
    enabled: form.get("enabled") !== "false",
    sortOrder: Number(form.get("sortOrder") || 99),
    createdAt: String(existing?.createdAt || now),
    updatedAt: now,
  };

  const next = existing
    ? videos.map((item) => (item.id === id ? record : item))
    : [...videos, record];
  await writeTable("prompt_videos", next);
  return Response.json({ video: record });
}

export async function DELETE(request: Request) {
  const { id } = await request.json() as { id?: string };
  if (!id) return Response.json({ error: "缺少视频 ID" }, { status: 400 });
  const videos = await readTable<PromptVideo>("prompt_videos");
  const row = videos.find((video) => video.id === id);
  if (row?.videoKey) await deleteMedia(row.videoKey);
  if (row?.posterKey) await deleteMedia(row.posterKey);
  await writeTable("prompt_videos", videos.filter((video) => video.id !== id));
  return Response.json({ ok: true });
}
