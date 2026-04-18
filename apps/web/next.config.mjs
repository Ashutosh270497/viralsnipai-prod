import { createRequire } from "module";

const require = createRequire(import.meta.url);

let withBundleAnalyzer = (config) => config;

try {
  const bundleAnalyzer = require("@next/bundle-analyzer");
  withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
} catch (error) {
  if (process.env.ANALYZE === "true") {
    console.warn(
      "[@next/bundle-analyzer] not installed. Skipping bundle analysis. Run `pnpm install` to enable ANALYZE mode."
    );
  }
}

const ffmpegPath = process.env.FFMPEG_PATH || require("ffmpeg-static");
const ffprobePath =
  process.env.FFPROBE_PATH || require("ffprobe-static").path || require("ffprobe-static");

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    // Tree-shake named exports from large icon + utility packages
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "framer-motion",
    ],
    instrumentationHook: true,
  },
  transpilePackages: ["@clippers/jobs", "@clippers/types"],
  env: {
    FFMPEG_PATH: ffmpegPath,
    FFPROBE_PATH: ffprobePath,
    UI_V2_ENABLED: process.env.UI_V2_ENABLED ?? "false",
    NEXT_PUBLIC_UI_V2_ENABLED:
      process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? process.env.UI_V2_ENABLED ?? "false",
  },
  images: {
    remotePatterns: [
      // Google OAuth avatars + Cloud Storage (Imagen/Veo outputs)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // YouTube thumbnails (competitor analysis)
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      // X / Twitter avatars and media
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
      // UploadThing file storage
      { protocol: "https", hostname: "utfs.io" },
      // AWS S3 / CloudFront
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      // OpenAI DALL-E image URLs
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  compress: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  swcMinify: true,
  // Strip console.* calls from production client bundles
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://api.openai.com https://openrouter.ai https://generativelanguage.googleapis.com wss: ws:",
              "frame-src https://checkout.razorpay.com https://api.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralsnipai.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
