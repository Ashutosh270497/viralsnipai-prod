/**
 * Startup recovery for the render queue.
 *
 * On cold start, any exports left in "queued" or "processing" state from a
 * previous process are stale. We re-queue them so they are processed in the
 * new process, or mark them failed if they've been stale too long.
 *
 * Call this once at server startup (e.g., from render-queue.ts or a Next.js
 * instrumentation hook).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { queueExportJob } from '@/lib/render-queue';

const STALE_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

let recoveryRan = false;

export async function recoverStalledExports(): Promise<void> {
  if (recoveryRan) return;
  recoveryRan = true;

  try {
    const staleExports = await prisma.export.findMany({
      where: {
        status: { in: ['queued', 'processing'] },
      },
      select: { id: true, status: true, updatedAt: true },
    });

    if (staleExports.length === 0) {
      logger.info('[Recovery] No stalled exports found');
      return;
    }

    logger.info(`[Recovery] Found ${staleExports.length} stalled export(s) — re-queuing`);

    const now = Date.now();
    for (const exp of staleExports) {
      const ageMs = now - new Date(exp.updatedAt).getTime();

      if (ageMs > STALE_PROCESSING_THRESHOLD_MS && exp.status === 'processing') {
        // Mark as failed — was processing too long and the process died
        await prisma.export.update({
          where: { id: exp.id },
          data: { status: 'failed', error: 'Process restarted while job was in progress. Please retry.' },
        });
        logger.warn(`[Recovery] Marked export ${exp.id} as failed (was processing for ${Math.round(ageMs / 1000)}s)`);
      } else {
        // Re-queue — was waiting or recently processing
        await prisma.export.update({
          where: { id: exp.id },
          data: { status: 'queued', error: null },
        });
        await queueExportJob(exp.id);
        logger.info(`[Recovery] Re-queued export ${exp.id}`);
      }
    }
  } catch (error) {
    logger.error('[Recovery] Failed to recover stalled exports', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
