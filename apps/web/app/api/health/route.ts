import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/health/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Unified system health check. Returns overall status plus per-service checks:
 *   - database (PostgreSQL latency)
 *   - environment (required env vars)
 *   - ffmpeg (binary availability + version)
 *   - remotionRenderer (enabled + entry point present)
 *   - cvWorker (reachable + models loaded)
 *   - exportQueue (active render jobs)
 *
 * Status codes:
 *   200 — healthy or degraded (app is operational, optional services may be missing)
 *   503 — unhealthy (required services failing)
 */
export async function GET() {
  const health = await getSystemHealth();
  const statusCode = health.overall === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
