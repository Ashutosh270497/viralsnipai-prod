export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getExportQueueSnapshot } from "@/lib/render-queue";

/**
 * GET /api/media/render-queue/health
 *
 * Returns a snapshot of the in-process export render queue.
 * Useful for monitoring dashboards and CI health gates.
 *
 * Response shape:
 *   {
 *     activeJobs: number;           // exports currently rendering
 *     stages: Record<string, number>;  // stage name → job count in that stage
 *     timestamp: string;
 *   }
 */
export async function GET() {
  const snapshot = getExportQueueSnapshot();
  return NextResponse.json(
    { ...snapshot, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
