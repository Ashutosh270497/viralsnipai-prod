import { act, renderHook } from "@testing-library/react";

import { useClipUpdateQueue } from "@/components/repurpose/use-clip-update-queue";
import type { ProjectClip } from "@/components/repurpose/types";

const clip = {
  id: "clip-1",
  version: 1,
  startMs: 0,
  endMs: 10_000,
  title: "Original",
} as ProjectClip;

function mockJsonResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("useClipUpdateQueue", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("serializes updates and retries a 409 once with the latest clip version", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(false, 409, {
          error: { message: "Clip was updated elsewhere. Refresh and try again." },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(true, 200, {
          project: {
            clips: [{ ...clip, version: 2, title: "Background caption update" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(true, 200, {
          data: { clip: { ...clip, version: 3, title: "User edit" } },
        }),
      );
    global.fetch = fetchMock as typeof fetch;
    const onConflictResolved = jest.fn();

    const { result } = renderHook(() =>
      useClipUpdateQueue({
        projectId: "project-1",
        clips: [clip],
        onConflictResolved,
      }),
    );

    await act(async () => {
      await result.current.updateClip("clip-1", { title: "User edit" }, { refresh: false });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/clips/clip-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "User edit", expectedVersion: 1 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/projects/project-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/clips/clip-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "User edit", expectedVersion: 2 }),
      }),
    );
    expect(onConflictResolved).toHaveBeenCalledTimes(1);
  });

  it("does not send unchanged fields or preview invalidation without an explicit flag", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const { result } = renderHook(() =>
      useClipUpdateQueue({
        projectId: "project-1",
        clips: [clip],
      }),
    );

    await act(async () => {
      await result.current.updateClip(
        "clip-1",
        { title: "Original", previewPath: null },
        { refresh: false },
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
