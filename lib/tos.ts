import { TosClient } from "@volcengine/tos-sdk";

/**
 * 火山云 TOS 存储适配层。
 * 替代原 Cloudflare D1（结构化数据）+ R2（媒体文件）：
 * - 结构化数据 → 以 JSON 文件形式存到 `lumera/data/<表名>.json`
 * - 媒体文件   → 存到 `lumera/media/<key>`
 */

const BUCKET = process.env.TOS_BUCKET || "";
const REGION = process.env.TOS_REGION || "cn-beijing";
const ENDPOINT = process.env.TOS_ENDPOINT || "tos-cn-beijing.volces.com";
const ACCESS_KEY_ID = process.env.TOS_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.TOS_SECRET_ACCESS_KEY || "";

const MEDIA_PREFIX = "lumera/media/";
const DATA_PREFIX = "lumera/data/";

let client: TosClient | null = null;

function getClient(): TosClient {
  if (!client) {
    if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
      throw new Error(
        "TOS 存储未配置：请设置环境变量 TOS_ACCESS_KEY_ID / TOS_SECRET_ACCESS_KEY / TOS_BUCKET"
      );
    }
    client = new TosClient({
      accessKeyId: ACCESS_KEY_ID,
      accessKeySecret: SECRET_ACCESS_KEY,
      region: REGION,
      endpoint: ENDPOINT,
    });
  }
  return client;
}

function mediaKey(key: string): string {
  return MEDIA_PREFIX + key.replace(/^\/+/, "");
}

function dataKey(name: string): string {
  return `${DATA_PREFIX}${name}.json`;
}

/** 上传媒体文件 */
export async function putMedia(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<void> {
  await getClient().putObject({
    bucket: BUCKET,
    key: mediaKey(key),
    body: data as never,
    contentType,
  });
}

/** 读取媒体文件，不存在时返回 null */
export async function getMedia(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await getClient().getObject({ bucket: BUCKET, key: mediaKey(key) });
    const headers = (response.headers || {}) as Record<string, string | undefined>;
    const contentType =
      headers["content-type"] || headers["Content-Type"] || inferContentType(key);
    return { data: response.data, contentType };
  } catch {
    return null;
  }
}

/** 删除媒体文件 */
export async function deleteMedia(key: string): Promise<void> {
  try {
    await getClient().deleteObject({ bucket: BUCKET, key: mediaKey(key) });
  } catch {
    // 删除失败（对象不存在等）忽略，不影响主流程
  }
}

/** 读取一个 JSON 数据表（数组），不存在时返回空数组 */
export async function readTable<T>(name: string): Promise<T[]> {
  try {
    const response = await getClient().getObject({ bucket: BUCKET, key: dataKey(name) });
    const parsed = JSON.parse(response.data.toString("utf8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** 写入一个 JSON 数据表（整体覆盖） */
export async function writeTable<T>(name: string, rows: T[]): Promise<void> {
  await getClient().putObject({
    bucket: BUCKET,
    key: dataKey(name),
    body: Buffer.from(JSON.stringify(rows)),
    contentType: "application/json",
  });
}

function inferContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}
