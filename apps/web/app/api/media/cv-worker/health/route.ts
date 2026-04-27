export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCvWorkerHealth } from "@/lib/media/cv-worker-client";

export async function GET() {
  const result = await getCvWorkerHealth();
  const statusCode = result.status === "unreachable" ? 503 : 200;
  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
