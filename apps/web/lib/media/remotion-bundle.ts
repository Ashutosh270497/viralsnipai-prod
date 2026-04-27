/**
 * Remotion Bundle Manager
 *
 * Builds the Remotion composition once and caches the bundle location for
 * the lifetime of the Node.js process. Subsequent render jobs reuse the
 * same bundle directory, avoiding a slow webpack build on every export.
 *
 * The bundle is invalidated if the cache file is removed from disk
 * (e.g. after /tmp cleanup) so we verify existence before reusing.
 */

import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { logger } from "@/lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

export const REMOTION_COMPOSITION_ID = "ClipExportComposition";
export const REMOTION_FPS = 30;
export const REMOTION_WIDTH = 1080;
export const REMOTION_HEIGHT = 1920;

// Webpack bundle cache directory (persists for the process lifetime)
const BUNDLE_CACHE_DIR = path.join(
  os.tmpdir(),
  "remotion-bundle-viralsnipai"
);

// ── Singleton state ───────────────────────────────────────────────────────────

let cachedBundleDir: string | null = null;
let bundleInFlight: Promise<string> | null = null;

function getEntryPoint(): string {
  return path.join(process.cwd(), "remotion-compositions", "index.ts");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the bundle location (a local directory served as an HTTP server by
 * @remotion/renderer). Builds the bundle the first time and caches it.
 *
 * Safe to call concurrently — only one build runs at a time.
 */
export async function getRemotionBundle(): Promise<string> {
  // Fast path: cached dir still on disk
  if (cachedBundleDir) {
    try {
      await fs.access(cachedBundleDir);
      return cachedBundleDir;
    } catch {
      logger.info("remotion: cached bundle dir gone, rebuilding", { cachedBundleDir });
      cachedBundleDir = null;
      bundleInFlight = null;
    }
  }

  // Serialize concurrent callers behind one promise
  if (!bundleInFlight) {
    bundleInFlight = buildBundle();
  }

  const result = await bundleInFlight;
  return result;
}

/**
 * Force-invalidate the bundle cache. Useful after updating compositions
 * in development without restarting the server.
 */
export function invalidateRemotionBundle(): void {
  cachedBundleDir = null;
  bundleInFlight = null;
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function buildBundle(): Promise<string> {
  // Dynamic import so @remotion/bundler is never loaded in the browser bundle
  const { bundle } = await import("@remotion/bundler");

  const entryPoint = getEntryPoint();

  logger.info("remotion: starting bundle", { entryPoint, outDir: BUNDLE_CACHE_DIR });
  const bundleStart = Date.now();

  try {
    const bundleLocation = await bundle({
      entryPoint,
      outDir: BUNDLE_CACHE_DIR,
      onProgress: (pct) => {
        if (pct % 25 === 0) logger.info("remotion: bundle progress", { pct });
      },
    });

    cachedBundleDir = bundleLocation;

    logger.info("remotion: bundle complete", {
      bundleLocation,
      durationMs: Date.now() - bundleStart,
    });

    return bundleLocation;
  } catch (error) {
    bundleInFlight = null;
    cachedBundleDir = null;
    logger.error("remotion: bundle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
