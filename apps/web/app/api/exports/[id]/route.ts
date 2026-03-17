export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { promises as fs } from "fs";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExportRuntimeState, isExportJobActive, queueExportJob } from "@/lib/render-queue";

const STALLED_QUEUED_RECOVERY_MS = 12_000;
const STALLED_PROCESSING_RECOVERY_MS = 45_000;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let exportRecord = await prisma.export.findFirst({
    where: {
      id: params.id,
      project: {
        userId: user.id
      }
    }
  });

  if (!exportRecord) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if ((exportRecord.status === "queued" || exportRecord.status === "processing") && !isExportJobActive(exportRecord.id)) {
    const queuedAt = new Date(exportRecord.updatedAt).getTime();
    const ageMs = Date.now() - queuedAt;
    const stalledThreshold =
      exportRecord.status === "processing"
        ? STALLED_PROCESSING_RECOVERY_MS
        : STALLED_QUEUED_RECOVERY_MS;

    if (ageMs >= stalledThreshold) {
      const outputExists = exportRecord.storagePath
        ? await fs.access(exportRecord.storagePath).then(() => true).catch(() => false)
        : false;

      if (outputExists) {
        await prisma.export.update({
          where: { id: exportRecord.id },
          data: { status: "done", error: null },
        });
      } else {
        await prisma.export.update({
          where: { id: exportRecord.id },
          data: {
            status: "queued",
            error:
              exportRecord.status === "processing"
                ? "Recovered stalled render job and re-queued automatically."
                : exportRecord.error,
          },
        });
        await queueExportJob(exportRecord.id);
      }

      const refreshed = await prisma.export.findUnique({ where: { id: exportRecord.id } });
      if (refreshed) {
        exportRecord = refreshed;
      }
    }
  }

  return NextResponse.json(
    { export: exportRecord, runtime: getExportRuntimeState(exportRecord.id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
