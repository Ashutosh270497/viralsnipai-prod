/**
 * POST /api/snipradar/assistant/ingest
 *
 * Admin-only endpoint to ingest the SnipRadar knowledge base into the DB.
 * Reads knowledge-base.md, splits it into per-section documents, embeds
 * each chunk, and upserts them into snipradar_kb_chunks.
 *
 * Auth: INGEST_SECRET header (never expose this key publicly)
 *
 * Usage:
 *   curl -X POST https://your-domain.com/api/snipradar/assistant/ingest \
 *     -H "x-ingest-secret: <INGEST_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { ingestDocument } from "@/lib/snipradar/assistant-kb";

const INGEST_SECRET = process.env.INGEST_SECRET;

export async function POST(req: NextRequest) {
  // Security gate
  const providedSecret = req.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || providedSecret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read the knowledge base markdown file
    const kbPath = join(process.cwd(), "lib", "snipradar", "knowledge-base.md");
    let fullText: string;

    try {
      fullText = readFileSync(kbPath, "utf-8");
    } catch {
      return NextResponse.json(
        { error: "knowledge-base.md not found at expected path" },
        { status: 500 }
      );
    }

    // Split by H2 sections — each section becomes a separate docId
    const sections = fullText.split(/^## /m).filter(Boolean);

    const results: Array<{ docId: string; inserted: number; embedded: number }> = [];

    for (const section of sections) {
      const lines = section.split("\n");
      const firstLine = lines[0].trim();

      // Skip the preamble (before first ##)
      if (!firstLine || firstLine.startsWith("#")) continue;

      const docId = firstLine; // e.g. "snipradar-overview"
      const content = lines.slice(1).join("\n").trim();

      if (!content) continue;

      const { inserted, embedded } = await ingestDocument(docId, content);
      results.push({ docId, inserted, embedded });
    }

    const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
    const totalEmbedded = results.reduce((s, r) => s + r.embedded, 0);

    return NextResponse.json({
      ok: true,
      sections: results.length,
      totalInserted,
      totalEmbedded,
      details: results,
    });
  } catch (err) {
    console.error("[KB Ingest] Error:", err);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
