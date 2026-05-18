import { act, renderHook } from "@testing-library/react";

import { useRepurposeIngest } from "@/components/repurpose/use-repurpose-ingest";
import { apiFetch } from "@/lib/http/client";

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const progressMock = {
  isActive: false,
  progress: 0,
  phase: "",
  start: jest.fn(),
  setPhase: jest.fn(),
  setAbsolute: jest.fn(),
  complete: jest.fn(),
  reset: jest.fn(),
};

jest.mock("@/hooks/use-progress", () => ({
  useProgress: () => progressMock,
}));

jest.mock("@/lib/http/client", () => ({
  apiFetch: jest.fn(),
  getFriendlyHttpErrorMessage: jest.fn(() => "Friendly error"),
}));

describe("useRepurposeIngest V1 payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiFetch as jest.Mock).mockResolvedValue({ data: { analytics: { clipsCreated: 3 } } });
  });

  it("sends the simplified V1 create payload with hidden defaults", async () => {
    const onProjectRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRepurposeIngest({
        projectId: "project-1",
        primaryAssetId: "asset-1",
        onProjectRefresh,
      }),
    );

    await act(async () => {
      await result.current.handleAutoHighlights({
        mode: "replace",
        qualityMode: "balanced",
        clipIntent: "auto",
        targetPlatform: "auto",
        target: 3,
        clipLengthPreset: "balanced",
        debugModelOverride: "",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/repurpose/auto-highlights",
      expect.objectContaining({
        method: "POST",
        operation: "generation",
      }),
    );

    const request = (apiFetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        assetId: "asset-1",
        mode: "replace",
        qualityMode: "balanced",
        clipIntent: "auto",
        targetPlatform: "auto",
        target: 3,
        clipLengthPreset: "balanced",
        audience: "Growth-focused creators",
        tone: "Tension \u2192 payoff, high energy",
        callToAction: "Drive viewers to subscribe or click through",
      }),
    );
    expect(JSON.parse(request.body)).not.toHaveProperty("debugModelOverride");
    expect(onProjectRefresh).toHaveBeenCalledTimes(1);
  });
});
