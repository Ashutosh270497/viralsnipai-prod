/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    clip: {
      findUnique: jest.fn(),
    },
    clipEditOperation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/clips/[id]/edit-operations/route";

const mockPrisma = prisma as unknown as {
  clip: { findUnique: jest.Mock };
  clipEditOperation: { findMany: jest.Mock; create: jest.Mock };
};

function request(body: unknown) {
  return new Request("http://localhost/api/clips/clip_1/edit-operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/clips/[id]/edit-operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), { params: { id: "clip_1" } });

    expect(response.status).toBe(401);
  });

  it("rejects invalid operation ranges", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });

    const response = await POST(
      request({ type: "remove_range", startMs: 2000, endMs: 1000 }),
      { params: { id: "clip_1" } },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.clipEditOperation.create).not.toHaveBeenCalled();
  });

  it("checks clip ownership before creating operations", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });
    mockPrisma.clip.findUnique.mockResolvedValue({
      id: "clip_1",
      project: { userId: "user_2" },
    });

    const response = await POST(
      request({ type: "remove_range", startMs: 1000, endMs: 1200 }),
      { params: { id: "clip_1" } },
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.clipEditOperation.create).not.toHaveBeenCalled();
  });

  it("creates valid edit operations", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });
    mockPrisma.clip.findUnique.mockResolvedValue({
      id: "clip_1",
      project: { userId: "user_1" },
    });
    mockPrisma.clipEditOperation.create.mockResolvedValue({
      id: "op_1",
      clipId: "clip_1",
      type: "remove_range",
      startMs: 1000,
      endMs: 1200,
      payload: null,
    });

    const response = await POST(
      request({ type: "remove_range", startMs: 1000, endMs: 1200 }),
      { params: { id: "clip_1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.clipEditOperation.create).toHaveBeenCalledWith({
      data: {
        clipId: "clip_1",
        type: "remove_range",
        startMs: 1000,
        endMs: 1200,
        payload: undefined,
      },
    });
    expect(body.data.operation.id).toBe("op_1");
  });
});
