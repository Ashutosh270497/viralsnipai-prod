import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/health/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/ready
 *
 * Deployment/readiness probe. It returns the same redacted service snapshot as
 * /api/health, but unhealthy required dependencies produce HTTP 503 so process
 * managers and deployment platforms can block traffic.
 */
export async function GET() {
  const health = await getSystemHealth();
  const statusCode = health.overall === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
