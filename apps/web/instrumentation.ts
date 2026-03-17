/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (both dev and production).
 * Used for startup tasks like stalled job recovery.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run in Node.js runtime, not Edge
    const { recoverStalledExports } = await import('@/lib/render-queue-recovery');
    const { validateEnv } = await import('@/lib/env-validation');
    const { registerGracefulShutdown } = await import('@/lib/graceful-shutdown');

    try {
      validateEnv();
    } catch (error) {
      console.error('[Startup] Environment validation failed:', error instanceof Error ? error.message : error);
      // Don't throw — allow server to start so health endpoint is reachable
    }

    // Register graceful shutdown handlers
    registerGracefulShutdown();

    // Delay recovery slightly to let DB connections warm up
    setTimeout(() => {
      void recoverStalledExports();
    }, 2000);
  }
}
