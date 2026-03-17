import {
  normalizeUnifiedActivityStatus,
  summarizeUnifiedActivityItems,
  type UnifiedActivityItem,
} from "../activity-center";

describe("normalizeUnifiedActivityStatus", () => {
  it("maps queue-like states into queued", () => {
    expect(normalizeUnifiedActivityStatus("scheduled")).toBe("queued");
    expect(normalizeUnifiedActivityStatus("queued")).toBe("queued");
  });

  it("maps processing-like states into processing", () => {
    expect(normalizeUnifiedActivityStatus("processing")).toBe("processing");
    expect(normalizeUnifiedActivityStatus("posting")).toBe("processing");
  });

  it("maps terminal success and failure states", () => {
    expect(normalizeUnifiedActivityStatus("posted")).toBe("succeeded");
    expect(normalizeUnifiedActivityStatus("failed")).toBe("failed");
    expect(normalizeUnifiedActivityStatus("partial")).toBe("needs_action");
  });
});

describe("summarizeUnifiedActivityItems", () => {
  it("counts normalized statuses correctly", () => {
    const items: UnifiedActivityItem[] = [
      {
        id: "1",
        domain: "creator_studio",
        kind: "script_generation",
        status: "succeeded",
        rawStatus: "completed",
        title: "Script",
        description: "Done",
        createdAt: "2026-03-08T10:00:00.000Z",
        updatedAt: "2026-03-08T10:00:00.000Z",
        progressPct: 100,
        error: null,
        nextAction: null,
        metadataSummary: [],
      },
      {
        id: "2",
        domain: "repurpose_os",
        kind: "youtube_ingest",
        status: "processing",
        rawStatus: "processing",
        title: "Ingest",
        description: "Running",
        createdAt: "2026-03-08T10:05:00.000Z",
        updatedAt: "2026-03-08T10:06:00.000Z",
        progressPct: 55,
        error: null,
        nextAction: null,
        metadataSummary: [],
      },
      {
        id: "3",
        domain: "snipradar",
        kind: "snipradar_scheduler_run",
        status: "needs_action",
        rawStatus: "partial",
        title: "Scheduler",
        description: "Review",
        createdAt: "2026-03-08T10:07:00.000Z",
        updatedAt: "2026-03-08T10:07:00.000Z",
        progressPct: null,
        error: "One draft failed",
        nextAction: null,
        metadataSummary: [],
      },
      {
        id: "4",
        domain: "transcribe",
        kind: "transcript_job",
        status: "failed",
        rawStatus: "failed",
        title: "Transcript",
        description: "Failed",
        createdAt: "2026-03-08T10:08:00.000Z",
        updatedAt: "2026-03-08T10:08:00.000Z",
        progressPct: null,
        error: "Timeout",
        nextAction: null,
        metadataSummary: [],
      },
    ];

    expect(summarizeUnifiedActivityItems(items)).toEqual({
      total: 4,
      queued: 0,
      processing: 1,
      succeeded: 1,
      failed: 1,
      needsAction: 1,
    });
  });
});
