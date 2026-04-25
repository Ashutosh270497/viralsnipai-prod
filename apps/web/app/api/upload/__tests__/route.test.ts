/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    project: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    asset: {
      create: jest.fn(),
    },
    usageLog: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/ffmpeg", () => ({
  __esModule: true,
  probeDuration: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  __esModule: true,
  saveBuffer: jest.fn(),
}));

import { getCurrentUser } from "@/lib/auth";

const { POST } = require("@/app/api/upload/route");

describe("POST /api/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated upload requests", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/upload", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("rejects unsupported file types with a structured error", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: "user_1",
      plan: "free",
      subscriptionTier: "free",
    });

    const formData = new FormData();
    formData.set("projectId", "project_1");
    formData.set("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");

    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });
});
