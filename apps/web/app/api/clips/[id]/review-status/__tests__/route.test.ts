/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentUser: jest.fn(),
}));

const clipRepo = {
  findById: jest.fn(),
  updateReviewStatus: jest.fn(),
};

const projectRepo = {
  findById: jest.fn(),
};

jest.mock("@/lib/infrastructure/di/container", () => ({
  __esModule: true,
  container: {
    get: jest.fn((type) => {
      if (type === "IClipRepository") return clipRepo;
      if (type === "IProjectRepository") return projectRepo;
      return null;
    }),
  },
}));

jest.mock("@/lib/infrastructure/di/types", () => ({
  __esModule: true,
  TYPES: {
    IClipRepository: "IClipRepository",
    IProjectRepository: "IProjectRepository",
  },
}));

import { getCurrentUser } from "@/lib/auth";
import { PATCH } from "@/app/api/clips/[id]/review-status/route";

function request(body: unknown) {
  return new Request("http://localhost/api/clips/clip_1/review-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/clips/[id]/review-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const response = await PATCH(request({ reviewStatus: "approved" }), {
      params: { id: "clip_1" },
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid review statuses", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });

    const response = await PATCH(request({ reviewStatus: "done" }), {
      params: { id: "clip_1" },
    });

    expect(response.status).toBe(400);
    expect(clipRepo.updateReviewStatus).not.toHaveBeenCalled();
  });

  it("checks project ownership before updating", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });
    clipRepo.findById.mockResolvedValue({ id: "clip_1", projectId: "project_1" });
    projectRepo.findById.mockResolvedValue({ id: "project_1", userId: "user_2" });

    const response = await PATCH(request({ reviewStatus: "approved" }), {
      params: { id: "clip_1" },
    });

    expect(response.status).toBe(403);
    expect(clipRepo.updateReviewStatus).not.toHaveBeenCalled();
  });

  it("persists valid review status updates", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user_1" });
    clipRepo.findById.mockResolvedValue({ id: "clip_1", projectId: "project_1" });
    projectRepo.findById.mockResolvedValue({ id: "project_1", userId: "user_1" });
    clipRepo.updateReviewStatus.mockResolvedValue({
      id: "clip_1",
      projectId: "project_1",
      reviewStatus: "export_ready",
    });

    const response = await PATCH(request({ reviewStatus: "export_ready" }), {
      params: { id: "clip_1" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(clipRepo.updateReviewStatus).toHaveBeenCalledWith("clip_1", "export_ready");
    expect(body.data.clip.reviewStatus).toBe("export_ready");
  });
});
