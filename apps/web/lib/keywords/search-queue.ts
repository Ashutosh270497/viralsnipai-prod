type QueueTask<T> = {
  enqueuedAt: number;
  timeoutMs: number;
  run: () => Promise<T>;
  resolve: (result: QueueExecutionResult<T>) => void;
  reject: (error: unknown) => void;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clampInt(parsed, min, max);
}

export interface QueueExecutionResult<T> {
  value: T;
  queueWaitMs: number;
  runDurationMs: number;
}

export interface KeywordSearchQueueStats {
  concurrency: number;
  maxQueueSize: number;
  taskTimeoutMs: number;
  active: number;
  queued: number;
  oldestWaitMs: number;
  totalProcessed: number;
  totalFailed: number;
  totalTimedOut: number;
  totalRejected: number;
  avgQueueWaitMs: number;
}

export class KeywordSearchQueueSaturatedError extends Error {
  constructor(maxQueueSize: number) {
    super(`Keyword search queue is full (max queued: ${maxQueueSize})`);
    this.name = "KeywordSearchQueueSaturatedError";
  }
}

export class KeywordSearchQueueTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Keyword search task exceeded timeout (${timeoutMs}ms)`);
    this.name = "KeywordSearchQueueTimeoutError";
  }
}

class KeywordSearchQueue {
  private readonly concurrency: number;
  private readonly maxQueueSize: number;
  private readonly taskTimeoutMs: number;

  private active = 0;
  private queue: Array<QueueTask<unknown>> = [];

  private totalProcessed = 0;
  private totalFailed = 0;
  private totalTimedOut = 0;
  private totalRejected = 0;
  private totalQueueWaitMs = 0;

  constructor() {
    this.concurrency = getEnvInt("KEYWORD_SEARCH_QUEUE_CONCURRENCY", 3, 1, 12);
    this.maxQueueSize = getEnvInt("KEYWORD_SEARCH_QUEUE_MAX_SIZE", 60, 5, 1000);
    this.taskTimeoutMs = getEnvInt("KEYWORD_SEARCH_TASK_TIMEOUT_MS", 25_000, 2000, 120_000);
  }

  async execute<T>(
    run: () => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<QueueExecutionResult<T>> {
    if (this.queue.length >= this.maxQueueSize) {
      this.totalRejected += 1;
      throw new KeywordSearchQueueSaturatedError(this.maxQueueSize);
    }

    const timeoutMs = clampInt(options?.timeoutMs ?? this.taskTimeoutMs, 1000, this.taskTimeoutMs);

    return new Promise<QueueExecutionResult<T>>((resolve, reject) => {
      this.queue.push({
        enqueuedAt: Date.now(),
        timeoutMs,
        run,
        resolve: resolve as (result: QueueExecutionResult<unknown>) => void,
        reject,
      });
      this.pump();
    });
  }

  getStats(): KeywordSearchQueueStats {
    const oldestWaitMs =
      this.queue.length > 0 ? Math.max(0, Date.now() - this.queue[0].enqueuedAt) : 0;
    return {
      concurrency: this.concurrency,
      maxQueueSize: this.maxQueueSize,
      taskTimeoutMs: this.taskTimeoutMs,
      active: this.active,
      queued: this.queue.length,
      oldestWaitMs,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalTimedOut: this.totalTimedOut,
      totalRejected: this.totalRejected,
      avgQueueWaitMs:
        this.totalProcessed > 0
          ? Math.round((this.totalQueueWaitMs / this.totalProcessed) * 100) / 100
          : 0,
    };
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) return;
      this.runTask(task);
    }
  }

  private runTask(task: QueueTask<unknown>) {
    this.active += 1;
    const startedAt = Date.now();
    const queueWaitMs = Math.max(0, startedAt - task.enqueuedAt);
    this.totalQueueWaitMs += queueWaitMs;

    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new KeywordSearchQueueTimeoutError(task.timeoutMs));
      }, task.timeoutMs);
    });

    Promise.race([task.run(), timeoutPromise])
      .then((value) => {
        const runDurationMs = Math.max(0, Date.now() - startedAt);
        this.totalProcessed += 1;
        task.resolve({ value, queueWaitMs, runDurationMs });
      })
      .catch((error) => {
        this.totalFailed += 1;
        if (error instanceof KeywordSearchQueueTimeoutError) {
          this.totalTimedOut += 1;
        }
        task.reject(error);
      })
      .finally(() => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        this.active = Math.max(0, this.active - 1);
        this.pump();
      });
  }
}

const globalKey = "__keywordSearchQueue__";
const globalScope = globalThis as typeof globalThis & {
  [globalKey]?: KeywordSearchQueue;
};

export function getKeywordSearchQueue(): KeywordSearchQueue {
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = new KeywordSearchQueue();
  }
  return globalScope[globalKey]!;
}
