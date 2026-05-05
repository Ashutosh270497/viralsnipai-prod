import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import { getLocalUploadDir } from "@/lib/storage";
import { logger } from "@/lib/logger";

const HTTP_URL_RE = /^https?:\/\//i;
const S3_URI_RE = /^s3:\/\/([^/]+)\/(.+)$/i;

export async function resolveLocalMediaPath(
  candidates: Array<string | null | undefined>,
  options?: {
    uploadDir?: string;
    cwd?: string;
  }
): Promise<string | null> {
  const uploadDir = options?.uploadDir ?? getLocalUploadDir();
  const cwd = options?.cwd ?? process.cwd();

  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const candidate = raw.trim();
    if (!candidate) continue;

    const possiblePaths: string[] = [];

    if (path.isAbsolute(candidate)) {
      possiblePaths.push(candidate);
    }
    if (candidate.startsWith("/api/uploads/")) {
      possiblePaths.push(path.join(uploadDir, candidate.slice("/api/uploads/".length)));
    }
    if (candidate.startsWith("/uploads/")) {
      possiblePaths.push(path.join(uploadDir, candidate.slice("/uploads/".length)));
      possiblePaths.push(path.join(cwd, "public", candidate.replace(/^\/+/, "")));
    }
    if (!HTTP_URL_RE.test(candidate) && !S3_URI_RE.test(candidate)) {
      possiblePaths.push(path.resolve(cwd, candidate));
      possiblePaths.push(path.join(uploadDir, candidate.replace(/^\/+/, "")));
    }

    for (const fullPath of [...new Set(possiblePaths)]) {
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Try next path candidate.
      }
    }
  }

  return null;
}

export async function requireLocalMediaPath(
  candidates: Array<string | null | undefined>,
  message = "Source media file not found on local storage."
): Promise<string> {
  const resolved = await resolveLocalMediaPath(candidates);
  if (!resolved) {
    throw new Error(message);
  }
  return resolved;
}

/**
 * Result of materializing a (possibly remote) media candidate to a local path.
 * Callers MUST invoke `cleanup()` once the file is no longer needed when
 * `wasDownloaded` is true. When `wasDownloaded` is false, the file already
 * existed locally and `cleanup()` is a no-op (safe to always call).
 */
export interface MaterializedMedia {
  localPath: string;
  wasDownloaded: boolean;
  cleanup: () => Promise<void>;
}

export interface MaterializeOptions {
  uploadDir?: string;
  cwd?: string;
  /** Bytes; default 2 GiB. Throws when remote `Content-Length` exceeds this. */
  maxBytes?: number;
  /** Defaults to `os.tmpdir()`. */
  tempDir?: string;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Resolve a media path to a local file, downloading from S3/HTTPS to a
 * tempfile when the candidate is remote. Use this in code paths that need to
 * pass an actual file path to FFmpeg/CV-worker — e.g. trim validation,
 * auto-highlights, smart-reframe analyze.
 *
 * Local candidates short-circuit (no copy). Remote candidates are streamed
 * to `${tempDir}/clippers-remote-${uuid}${ext}` and cleaned up when the
 * caller invokes `result.cleanup()`.
 *
 * Why not just download in `resolveLocalMediaPath` — that function is sync-
 * adjacent: it just probes the filesystem. Adding side-effecting downloads
 * to it would silently make every reframe/trim allocate disk on every call.
 * This function makes the cost explicit at the call site.
 */
export async function materializeMediaLocally(
  candidates: Array<string | null | undefined>,
  options?: MaterializeOptions
): Promise<MaterializedMedia | null> {
  // 1. Try local resolution first — cheapest path.
  const local = await resolveLocalMediaPath(candidates, {
    uploadDir: options?.uploadDir,
    cwd: options?.cwd,
  });
  if (local) {
    return {
      localPath: local,
      wasDownloaded: false,
      cleanup: async () => {
        // Local files are owned by upstream callers; never delete here.
      },
    };
  }

  // 2. Walk remote candidates in order, materializing the first viable one.
  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const candidate = raw.trim();
    if (!candidate) continue;

    const s3Match = candidate.match(S3_URI_RE);
    if (s3Match) {
      try {
        const downloaded = await downloadS3Object({
          bucket: s3Match[1],
          key: s3Match[2],
          tempDir: options?.tempDir ?? os.tmpdir(),
          maxBytes: options?.maxBytes ?? DEFAULT_MAX_BYTES,
        });
        return downloaded;
      } catch (err) {
        logger.warn("media-path-resolver: s3 fetch failed", {
          uri: candidate,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    if (HTTP_URL_RE.test(candidate)) {
      try {
        const downloaded = await downloadHttpUrl({
          url: candidate,
          tempDir: options?.tempDir ?? os.tmpdir(),
          maxBytes: options?.maxBytes ?? DEFAULT_MAX_BYTES,
        });
        return downloaded;
      } catch (err) {
        logger.warn("media-path-resolver: http fetch failed", {
          url: candidate,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  return null;
}

function makeTempPath(tempDir: string, sourceForExt: string): string {
  const ext = path.extname(new URL(sourceForExt, "https://placeholder.invalid").pathname) || "";
  return path.join(tempDir, `clippers-remote-${randomUUID()}${ext}`);
}

async function downloadHttpUrl(params: {
  url: string;
  tempDir: string;
  maxBytes: number;
}): Promise<MaterializedMedia> {
  const { url, tempDir, maxBytes } = params;
  await fs.mkdir(tempDir, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Remote file is ${contentLength} bytes; exceeds maxBytes=${maxBytes}`);
  }

  if (!response.body) {
    throw new Error("Remote response has no body stream");
  }

  const localPath = makeTempPath(tempDir, url);
  // Cast: Node 20+ web ReadableStream is interoperable with Readable.fromWeb.
  const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  const fileWriter = (await fs.open(localPath, "w")).createWriteStream();

  let bytesWritten = 0;
  nodeStream.on("data", (chunk: Buffer | string) => {
    bytesWritten += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
    if (bytesWritten > maxBytes) {
      nodeStream.destroy(new Error(`Remote stream exceeded maxBytes=${maxBytes}`));
    }
  });

  try {
    await pipeline(nodeStream, fileWriter);
  } catch (err) {
    await fs.rm(localPath, { force: true }).catch(() => null);
    throw err;
  }

  return {
    localPath,
    wasDownloaded: true,
    cleanup: async () => {
      await fs.rm(localPath, { force: true }).catch(() => null);
    },
  };
}

async function downloadS3Object(params: {
  bucket: string;
  key: string;
  tempDir: string;
  maxBytes: number;
}): Promise<MaterializedMedia> {
  const { bucket, key, tempDir, maxBytes } = params;
  await fs.mkdir(tempDir, { recursive: true });

  // Lazy-import to avoid pulling the S3 SDK into bundles that never need it.
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });

  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const contentLength = Number(result.ContentLength);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`S3 object is ${contentLength} bytes; exceeds maxBytes=${maxBytes}`);
  }

  if (!result.Body) {
    throw new Error("S3 GetObject returned no body");
  }

  const localPath = makeTempPath(tempDir, `s3://${bucket}/${key}`);
  const body = result.Body as Readable;
  const fileWriter = (await fs.open(localPath, "w")).createWriteStream();

  let bytesWritten = 0;
  body.on("data", (chunk: Buffer | string) => {
    bytesWritten += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
    if (bytesWritten > maxBytes) {
      body.destroy(new Error(`S3 stream exceeded maxBytes=${maxBytes}`));
    }
  });

  try {
    await pipeline(body, fileWriter);
  } catch (err) {
    await fs.rm(localPath, { force: true }).catch(() => null);
    throw err;
  }

  return {
    localPath,
    wasDownloaded: true,
    cleanup: async () => {
      await fs.rm(localPath, { force: true }).catch(() => null);
    },
  };
}
