import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import ytdl from "ytdl-core";
import { execFile } from "child_process";
import { promisify } from "util";

import { ensureUploadsSubdir, getLocalUploadDir, getStorageDriver } from "@/lib/storage";
import { normalizeVideo, probeDuration } from "@/lib/ffmpeg";

const DEFAULT_USER_AGENT =
  process.env.YT_DLP_USER_AGENT ??
  "Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230805.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";

const SUPPORTED_COOKIE_ENV_KEYS = ["YT_DLP_COOKIES_PATH", "YT_COOKIES_PATH", "YOUTUBE_COOKIES_PATH"] as const;
const COOKIES_BROWSER_ENV = "YT_DLP_COOKIES_FROM_BROWSER";
const DEFAULT_EXTRACTOR_ARGS = "youtube:player_client=android,web";

function resolveCookiesFile() {
  for (const key of SUPPORTED_COOKIE_ENV_KEYS) {
    const value = process.env[key];
    if (value && fs.existsSync(value)) {
      return value;
    }
  }
  return null;
}

function resolveCookiesFromBrowser() {
  const value = process.env[COOKIES_BROWSER_ENV];
  if (!value) {
    return null;
  }
  return value.trim();
}

function buildYtDlpDownloadArgs(url: string, outputPath: string, cookiesPath: string | null, cookiesFromBrowser: string | null) {
  const args: string[] = [
    url,
    "--format",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--output",
    outputPath,
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--retries",
    "5",
    "--fragment-retries",
    "10",
    "--concurrent-fragments",
    "4",
    "--throttled-rate",
    "100K",
    "--add-header",
    `Referer: ${url}`,
    "--add-header",
    `User-Agent: ${DEFAULT_USER_AGENT}`,
    "--add-header",
    "Accept-Language: en-US,en;q=0.9"
  ];
  if (DEFAULT_EXTRACTOR_ARGS) {
    args.push("--extractor-args", DEFAULT_EXTRACTOR_ARGS);
  }

  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }
  if (cookiesFromBrowser) {
    args.push("--cookies-from-browser", cookiesFromBrowser);
  }

  return args;
}

function loadCookieHeader(cookiesPath: string | null) {
  if (!cookiesPath) {
    return null;
  }

  try {
    const contents = fs.readFileSync(cookiesPath, "utf8");
    const pairs = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/[\t\s]+/))
      .filter((parts) => parts.length >= 7)
      .map((parts) => ({ name: parts[5], value: parts[6] }))
      .filter((entry) => entry.name)
      .map((entry) => `${entry.name}=${entry.value}`);

    if (pairs.length > 0) {
      return pairs.join("; ");
    }
  } catch (error) {
    console.warn("Unable to read cookies file for header", error);
  }

  return null;
}

export interface DownloadResult {
  filePath: string;
  publicPath: string;
  durationSec: number | null;
  title?: string;
  thumbnail?: string;
}

const execFileAsync = promisify(execFile);

interface YtDlpCandidate {
  command: string;
  prefixArgs?: string[];
}

const YT_DLP_CANDIDATES: YtDlpCandidate[] = [
  process.env.YT_DLP_PATH ? { command: process.env.YT_DLP_PATH } : null,
  { command: "yt-dlp" },
  { command: "/opt/homebrew/bin/yt-dlp" },
  { command: "/usr/local/bin/yt-dlp" },
  { command: "/usr/bin/yt-dlp" },
  { command: "youtube-dl" },
  { command: "python3", prefixArgs: ["-m", "yt_dlp"] }
].filter(Boolean) as YtDlpCandidate[];

async function runYtDlp(args: string[]) {
  let lastError: unknown;
  let meaningfulError: unknown;
  for (const candidate of YT_DLP_CANDIDATES) {
    try {
      const fullArgs = candidate.prefixArgs ? [...candidate.prefixArgs, ...args] : args;
      return await execFileAsync(candidate.command, fullArgs, {
        maxBuffer: 20 * 1024 * 1024
      });
    } catch (error) {
      console.warn(`yt-dlp candidate failed: ${candidate.command}`, error);

      let message = "";
      if (error instanceof Error) {
        message = error.message;
        const stderr = typeof (error as any).stderr === "string" ? (error as any).stderr : "";
        if (stderr) {
          message = `${message}\n${stderr}`;
        }
      } else {
        message = String(error);
      }

      const errorWithMeta = error as NodeJS.ErrnoException & { stderr?: unknown };
      const isMissingModule = /No module named yt_dlp/i.test(message);
      const isMissingBinary =
        (typeof errorWithMeta.code === "string" && errorWithMeta.code === "ENOENT") || /not found/i.test(message);

      if (!isMissingModule && !isMissingBinary) {
        meaningfulError = error;
      }

      lastError = error;
    }
  }
  const errorToThrow = (meaningfulError ?? lastError) as Error | undefined;
  if (errorToThrow) {
    throw errorToThrow;
  }
  throw new Error("yt-dlp not found on PATH");
}

export async function downloadYouTubeVideo(url: string, projectId: string): Promise<DownloadResult> {
  if (!ytdl.validateURL(url)) {
    throw new Error("Invalid YouTube URL");
  }

  if (getStorageDriver() !== "local") {
    throw new Error("YouTube ingest is only supported with local storage. Switch STORAGE_DRIVER=local.");
  }

  const cookiesPath = resolveCookiesFile();
  const cookieHeader = loadCookieHeader(cookiesPath);
  const cookiesFromBrowser = resolveCookiesFromBrowser();

  let title = "YouTube Source";
  let thumbnail: string | undefined;
  let durationSec: number | null = null;

  const requestHeaders = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
    Referer: url,
    ...(cookieHeader ? { Cookie: cookieHeader } : {})
  };

  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: requestHeaders
      }
    });
    title = info.videoDetails.title ?? title;
    thumbnail = info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url;
    const rawDuration = Number.parseInt(info.videoDetails.lengthSeconds, 10);
    if (Number.isFinite(rawDuration)) {
      durationSec = rawDuration;
    }
  } catch (primaryError) {
    try {
      const args = ["--dump-json", url, "--no-warnings", "--no-check-certificate"];
      if (DEFAULT_EXTRACTOR_ARGS) {
        args.push("--extractor-args", DEFAULT_EXTRACTOR_ARGS);
      }
      if (cookiesPath) {
        args.push("--cookies", cookiesPath);
      }
      if (cookiesFromBrowser) {
        args.push("--cookies-from-browser", cookiesFromBrowser);
      }
      const { stdout } = await runYtDlp(args);
      const metadata = JSON.parse(stdout);
      title = metadata.title ?? title;
      thumbnail = metadata.thumbnail ?? thumbnail;
      if (metadata.duration && Number.isFinite(Number(metadata.duration))) {
        durationSec = Math.round(Number(metadata.duration));
      }
    } catch (fallbackError) {
      console.error("yt-dlp metadata fetch failed", fallbackError);
      const reason =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown yt-dlp error. Ensure yt-dlp is installed and accessible via PATH or YT_DLP_PATH.";
      throw new Error(
        `Failed to retrieve YouTube metadata. The video may be private, age-restricted, or yt-dlp is not installed. ${reason}`
      );
    }
  }

  const uploadsDir = getLocalUploadDir();
  const projectDir = await ensureUploadsSubdir(`${projectId}/assets`);

  const safeTitle = title.replace(/[^\w\d_-]+/g, "-").slice(0, 48) || "youtube-source";
  const filename = `${safeTitle}-${Date.now()}.mp4`;
  const absolutePath = path.join(projectDir, filename);
  const relativePath = path.relative(uploadsDir, absolutePath);
  const publicPath = `/api/uploads/${relativePath}`;

  let downloaded = false;
  try {
    const videoStream = ytdl(url, {
      quality: "highest",
      filter: "audioandvideo",
      highWaterMark: 1 << 25,
      requestOptions: {
        headers: requestHeaders
      }
    });
    await pipeline(videoStream, fs.createWriteStream(absolutePath));
    downloaded = true;
  } catch (primaryError) {
    console.warn("ytdl download failed, attempting yt-dlp fallback", primaryError);
  }

  if (!downloaded) {
    const tempOut = `${absolutePath}.download.mp4`;
    try {
      await runYtDlp(buildYtDlpDownloadArgs(url, tempOut, cookiesPath, cookiesFromBrowser));
      await fsp.rename(tempOut, absolutePath);
    } catch (fallbackError) {
      const needsCookies =
        fallbackError instanceof Error &&
        /403/.test(fallbackError.message ?? "") &&
        !cookiesPath &&
        !cookiesFromBrowser;

      const reason =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown yt-dlp error. Ensure yt-dlp is installed and accessible via PATH or YT_DLP_PATH.";

      const suggestedFix = needsCookies
        ? "This video is likely age-restricted or geo-blocked. Provide cookies by setting YT_DLP_COOKIES_PATH (Netscape cookie file) or YT_DLP_COOKIES_FROM_BROWSER (e.g. chrome, firefox)."
        : "Check network access, yt-dlp version, or configure authentication cookies for restricted videos.";

      throw new Error(`YouTube download failed. ${reason} ${suggestedFix}`);
    }
  }

  const tempSourcePath = `${absolutePath}.source`;
  await fsp.rename(absolutePath, tempSourcePath);
  await normalizeVideo({ inputPath: tempSourcePath, outputPath: absolutePath });
  await fsp.unlink(tempSourcePath).catch(() => null);

  try {
    const duration = await probeDuration(absolutePath);
    if (duration && Number.isFinite(duration)) {
      durationSec = Math.round(duration);
    }
  } catch (error) {
    console.warn("Unable to probe downloaded YouTube asset", error);
  }

  return {
    filePath: absolutePath,
    publicPath,
    durationSec,
    title,
    thumbnail
  };
}
