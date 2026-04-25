/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    export: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/render-queue", () => ({
  __esModule: true,
  getExportRuntimeState: jest.fn(),
  isExportJobActive: jest.fn(),
  queueExportJob: jest.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExportRuntimeState, isExportJobActive } from "@/lib/render-queue";

const { GET } = require("@/app/api/exports/[id]/route");

describe("GET /api/exports/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });
    (isExportJobActive as jest.Mock).mockReturnValue(false);
    (getExportRuntimeState as jest.Mock).mockReturnValue(null);
  });

  it("does not expose another user's export", async () => {
    (prisma.export.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/exports/export_1"), {
      params: { id: "export_1" },
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(prisma.export.findFirst).toHaveBeenCalledWith({
      where: {
        id: "export_1",
        project: {
          userId: "user_1",
        },
      },
    });
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns structured completed export status", async () => {
    (prisma.export.findFirst as jest.Mock).mockResolvedValue({
      id: "export_1",
      projectId: "project_1",
      clipIds: ["clip_1"],
      preset: "shorts_9x16_1080",
      includeCaptions: true,
      outputPath: "/api/uploads/exports/export_1.mp4",
      storagePath: "/tmp/export_1.mp4",
      status: "done",
      error: null,
      createdAt: new Date("2026-04-25T00:00:00.000Z"),
      updatedAt: new Date("2026-04-25T00:00:01.000Z"),
    });

    const response = await GET(new Request("http://localhost/api/exports/export_1"), {
      params: { id: "export_1" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        export: {
          id: "export_1",
          status: "completed",
          internalStatus: "done",
          downloadUrl: "/api/uploads/exports/export_1.mp4",
        },
        status: {
          value: "completed",
          progressPct: 100,
          retryable: false,
        },
      },
    });
  });
});
