import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 视频/图片上传走 multipart/form-data，默认 1MB 会触发 413，这里放宽到 100MB
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
