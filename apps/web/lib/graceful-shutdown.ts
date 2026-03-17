/**
 * Graceful shutdown handler.
 * Ensures in-flight requests complete before the process exits.
 * Register this once in your server entrypoint or instrumentation.ts.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

let isShuttingDown = false;

export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

export function registerGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Shutdown] Received ${signal}, starting graceful shutdown`);

    // Give in-flight requests 15 seconds to complete
    const forceExitTimer = setTimeout(() => {
      logger.warn('[Shutdown] Force exit after 15s timeout');
      process.exit(1);
    }, 15_000);
    forceExitTimer.unref?.();

    try {
      // Disconnect Prisma cleanly
      await prisma.$disconnect();
      logger.info('[Shutdown] Prisma disconnected');
    } catch (error) {
      logger.error('[Shutdown] Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    clearTimeout(forceExitTimer);
    logger.info('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
