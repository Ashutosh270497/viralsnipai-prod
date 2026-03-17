export interface KeywordSearchRuntimeSample {
  timestamp: number;
  durationMs: number;
  queueWaitMs: number;
  status: number;
  cacheHit: boolean;
  source: "cache" | "fresh" | "fallback";
}

export interface KeywordRuntimeSummary {
  windowMs: number;
  samples: number;
  successCount: number;
  errorCount: number;
  errorRatePct: number;
  cacheHitRatePct: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p50QueueWaitMs: number;
  p95QueueWaitMs: number;
  slo: {
    p95LatencyMs: number;
    maxErrorRatePct: number;
    latencyMet: boolean;
    errorRateMet: boolean;
  };
}

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

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIndex = Math.min(sorted.length - 1, Math.max(0, index));
  return sorted[safeIndex];
}

class KeywordRuntimeMetricsCollector {
  private readonly maxSamples: number;
  private readonly defaultWindowMs: number;
  private readonly p95LatencySloMs: number;
  private readonly errorRateSloPct: number;
  private samples: KeywordSearchRuntimeSample[] = [];

  constructor() {
    this.maxSamples = getEnvInt("KEYWORD_METRICS_MAX_SAMPLES", 1000, 100, 20_000);
    this.defaultWindowMs =
      getEnvInt("KEYWORD_METRICS_WINDOW_SECONDS", 3600, 60, 24 * 60 * 60) * 1000;
    this.p95LatencySloMs = getEnvInt("KEYWORD_SEARCH_SLO_P95_MS", 2500, 200, 30_000);
    this.errorRateSloPct = getEnvInt("KEYWORD_SEARCH_SLO_ERROR_RATE_PCT", 2, 1, 100);
  }

  record(sample: Omit<KeywordSearchRuntimeSample, "timestamp">): void {
    this.samples.push({
      timestamp: Date.now(),
      ...sample,
    });
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(this.samples.length - this.maxSamples);
    }
  }

  getSummary(windowMs?: number): KeywordRuntimeSummary {
    const effectiveWindowMs = clampInt(
      windowMs ?? this.defaultWindowMs,
      10_000,
      7 * 24 * 60 * 60 * 1000,
    );
    const floor = Date.now() - effectiveWindowMs;
    const inWindow = this.samples.filter((sample) => sample.timestamp >= floor);
    const durationValues = inWindow.map((sample) => sample.durationMs);
    const queueWaitValues = inWindow.map((sample) => sample.queueWaitMs);

    const errorCount = inWindow.filter(
      (sample) => sample.status >= 500 || sample.status === 429,
    ).length;
    const successCount = inWindow.length - errorCount;
    const cacheHitCount = inWindow.filter((sample) => sample.cacheHit).length;
    const errorRatePct =
      inWindow.length > 0 ? Number(((errorCount / inWindow.length) * 100).toFixed(2)) : 0;
    const cacheHitRatePct =
      inWindow.length > 0 ? Number(((cacheHitCount / inWindow.length) * 100).toFixed(2)) : 0;

    const p95DurationMs = percentile(durationValues, 95);
    const p95QueueWaitMs = percentile(queueWaitValues, 95);

    return {
      windowMs: effectiveWindowMs,
      samples: inWindow.length,
      successCount,
      errorCount,
      errorRatePct,
      cacheHitRatePct,
      p50DurationMs: percentile(durationValues, 50),
      p95DurationMs,
      p50QueueWaitMs: percentile(queueWaitValues, 50),
      p95QueueWaitMs,
      slo: {
        p95LatencyMs: this.p95LatencySloMs,
        maxErrorRatePct: this.errorRateSloPct,
        latencyMet: p95DurationMs <= this.p95LatencySloMs,
        errorRateMet: errorRatePct <= this.errorRateSloPct,
      },
    };
  }
}

const globalKey = "__keywordRuntimeMetricsCollector__";
const globalScope = globalThis as typeof globalThis & {
  [globalKey]?: KeywordRuntimeMetricsCollector;
};

export function getKeywordRuntimeMetricsCollector(): KeywordRuntimeMetricsCollector {
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = new KeywordRuntimeMetricsCollector();
  }
  return globalScope[globalKey]!;
}
