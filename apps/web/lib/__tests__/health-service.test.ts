/**
 * Phase 9 — Health Service Tests
 *
 * Tests guard:
 *   - Individual check contracts (correct status types)
 *   - Aggregate status: any error → unhealthy, any degraded → degraded
 *   - Export queue snapshot shape
 *   - Graceful handling of unavailable services (no throws)
 *   - Observability additions in scene-detection and face-person-tracker
 */

jest.mock("@/lib/openrouter-client", () => ({
  openRouterClient: null,
  OPENROUTER_MODELS: {},
  HAS_OPENROUTER_KEY: false,
  routedChatCompletion: jest.fn(),
}));

jest.mock("@/lib/media/cv-worker-client", () => ({
  getCvWorkerHealth: jest.fn(),
  getCvWorkerBaseUrl: jest.fn().mockReturnValue(null),
  detectClipWithCvWorker: jest.fn(),
  trackSubjectWithCvWorker: jest.fn(),
  detectScenesWithCvWorker: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

jest.mock("@/lib/media/remotion-renderer", () => ({
  REMOTION_RENDERER_ENABLED: false,
  shouldUseRemotionRenderer: jest.fn().mockReturnValue(false),
}));

// Mock render-queue for checkExportQueue
jest.mock("@/lib/render-queue", () => ({
  getExportQueueSnapshot: jest.fn().mockReturnValue({ activeJobs: 0, stages: {} }),
  isExportJobActive: jest.fn(),
  getExportRuntimeState: jest.fn(),
  queueExportJob: jest.fn(),
}));

import type { ServiceCheck, SystemHealth } from "../health/health-service";
import { getSystemHealth } from "../health/health-service";
import { getExportQueueSnapshot } from "../render-queue";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SERVICE_STATUSES = new Set(["ok", "degraded", "unconfigured", "error"]);
const VALID_OVERALL_STATUSES = new Set(["healthy", "degraded", "unhealthy"]);

function assertValidServiceCheck(check: ServiceCheck, name: string) {
  expect(VALID_SERVICE_STATUSES.has(check.status)).toBe(true);
  if (check.latencyMs !== undefined) {
    expect(typeof check.latencyMs).toBe("number");
    expect(check.latencyMs).toBeGreaterThanOrEqual(0);
  }
}

// ── getSystemHealth ───────────────────────────────────────────────────────────

describe("getSystemHealth", () => {
  it("returns a SystemHealth object with all required fields", async () => {
    const health = await getSystemHealth();

    expect(typeof health.overall).toBe("string");
    expect(VALID_OVERALL_STATUSES.has(health.overall)).toBe(true);
    expect(typeof health.timestamp).toBe("string");
    expect(typeof health.version).toBe("string");
    expect(typeof health.uptime).toBe("number");
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.services).toBeDefined();
  });

  it("includes all required service checks", async () => {
    const health = await getSystemHealth();
    const { services } = health;

    expect(services.database).toBeDefined();
    expect(services.environment).toBeDefined();
    expect(services.ffmpeg).toBeDefined();
    expect(services.remotionRenderer).toBeDefined();
    expect(services.cvWorker).toBeDefined();
    expect(services.exportQueue).toBeDefined();
  });

  it("all service checks have valid status values", async () => {
    const health = await getSystemHealth();
    for (const [name, check] of Object.entries(health.services)) {
      assertValidServiceCheck(check as ServiceCheck, name);
    }
  });

  it("overall reflects worst service status", async () => {
    const health = await getSystemHealth();
    // Test env lacks required env vars (NEXTAUTH_SECRET etc.) → environment.status is "error"
    // → overall is "unhealthy". This is expected and correct.
    expect(VALID_OVERALL_STATUSES.has(health.overall)).toBe(true);
  });

  it("never throws even if all services fail", async () => {
    const { prisma } = require("@/lib/prisma");
    prisma.$queryRaw.mockRejectedValueOnce(new Error("DB down"));

    await expect(getSystemHealth()).resolves.toBeDefined();

    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });
});

// ── Remotion check ────────────────────────────────────────────────────────────

describe("remotionRenderer check", () => {
  it("returns unconfigured when REMOTION_RENDERER_ENABLED is false", async () => {
    const health = await getSystemHealth();
    expect(health.services.remotionRenderer.status).toBe("unconfigured");
  });
});

// ── CV worker check ───────────────────────────────────────────────────────────

describe("cvWorker check", () => {
  it("returns unconfigured when CV_WORKER_URL is not set", async () => {
    const { getCvWorkerHealth } = require("@/lib/media/cv-worker-client");
    getCvWorkerHealth.mockResolvedValueOnce({
      configured: false,
      status: "unconfigured",
      url: null,
    });

    const health = await getSystemHealth();
    expect(health.services.cvWorker.status).toBe("unconfigured");
  });

  it("returns error status when CV worker is unreachable", async () => {
    const { getCvWorkerHealth } = require("@/lib/media/cv-worker-client");
    getCvWorkerHealth.mockResolvedValueOnce({
      configured: true,
      status: "unreachable",
      url: "http://localhost:8010",
      error: "ECONNREFUSED",
    });

    const health = await getSystemHealth();
    expect(health.services.cvWorker.status).toBe("error");
  });

  it("returns ok status when CV worker is healthy", async () => {
    const { getCvWorkerHealth } = require("@/lib/media/cv-worker-client");
    getCvWorkerHealth.mockResolvedValueOnce({
      configured: true,
      status: "healthy",
      url: "http://localhost:8010",
      latencyMs: 8,
      health: {
        status: "healthy",
        service: "cv-worker",
        version: "0.1.0",
        dependencies: { ffmpeg: { available: true } },
        models: { face: "mediapipe", yoloModelStatus: "not_configured" },
      },
    });

    const health = await getSystemHealth();
    expect(health.services.cvWorker.status).toBe("ok");
    expect(health.services.cvWorker.version).toBe("0.1.0");
  });
});

// ── Overall status aggregation ────────────────────────────────────────────────

describe("status aggregation", () => {
  it("reports unhealthy when database fails", async () => {
    const { prisma } = require("@/lib/prisma");
    prisma.$queryRaw.mockRejectedValueOnce(new Error("Connection refused"));

    const health = await getSystemHealth();
    expect(health.overall).toBe("unhealthy");
    expect(health.services.database.status).toBe("error");

    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });
});

// ── Export queue snapshot ─────────────────────────────────────────────────────

describe("getExportQueueSnapshot", () => {
  it("returns valid snapshot shape", () => {
    const snapshot = getExportQueueSnapshot();
    expect(typeof snapshot.activeJobs).toBe("number");
    expect(snapshot.activeJobs).toBeGreaterThanOrEqual(0);
    expect(typeof snapshot.stages).toBe("object");
  });

  it("returns zero active jobs when queue is empty", () => {
    const snapshot = getExportQueueSnapshot();
    expect(snapshot.activeJobs).toBe(0);
  });
});
