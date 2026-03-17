export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { searchChannels } from "@/lib/integrations/youtube-channels";

/**
 * Serialize BigInt values to strings for JSON response
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

/**
 * GET /api/competitors/search?q=query
 * Search for YouTube channels by name
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const channels = await searchChannels(query.trim(), 5);

    return NextResponse.json(
      { channels: serializeBigInt(channels) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] Search error:", error);
    return NextResponse.json(
      { error: "Failed to search channels" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
