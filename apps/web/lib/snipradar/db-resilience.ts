export function isDbPoolSaturationError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  const lower = message.toLowerCase();
  return (
    code === "P2024" ||
    code === "P1017" ||
    lower.includes("maxclientsinsessionmode") ||
    lower.includes("max clients reached") ||
    lower.includes("too many clients") ||
    lower.includes("too many connections") ||
    lower.includes("timed out fetching a new connection from the connection pool") ||
    lower.includes("server has closed the connection") ||
    lower.includes("operation timed out") ||
    lower.includes("connection reset by peer")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DbRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Retries only transient DB saturation/connection failures.
 * Any non-pool error is thrown immediately.
 */
export async function withDbPoolRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: DbRetryOptions = {}
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 2);
  const baseDelayMs = Math.max(20, options.baseDelayMs ?? 120);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 1500);

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isDbPoolSaturationError(error) || attempt >= retries) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 40);
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt + jitter);
      console.warn(`[SnipRadar DB] transient saturation on ${operation}; retrying`, {
        attempt: attempt + 1,
        delayMs: delay,
      });
      attempt += 1;
      await sleep(delay);
    }
  }
}
