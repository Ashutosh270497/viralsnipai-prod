import { createRequire } from "module";

const require = createRequire(import.meta.url);

const ffmpegPath = process.env.FFMPEG_PATH || require("ffmpeg-static");
const ffprobePath =
  process.env.FFPROBE_PATH || require("ffprobe-static").path || require("ffprobe-static");

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    }
  },
  transpilePackages: ["@clippers/jobs", "@clippers/types"],
  env: {
    FFMPEG_PATH: ffmpegPath,
    FFPROBE_PATH: ffprobePath,
    UI_V2_ENABLED: process.env.UI_V2_ENABLED ?? "false",
    NEXT_PUBLIC_UI_V2_ENABLED: process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? process.env.UI_V2_ENABLED ?? "false"
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
