import { render, screen } from "@testing-library/react";

import { ExportPanel } from "@/components/repurpose/export-panel";

const baseProps = {
  projectId: "project-1",
  exports: [],
  selectedPreset: "shorts_9x16_1080",
  onPresetChange: jest.fn(),
  selectedPlatformPreset: "youtube_shorts" as const,
  onPlatformPresetChange: jest.fn(),
};

describe("ExportPanel", () => {
  it("hides duplicate platform selection when page-level format selector is used", () => {
    render(
      <ExportPanel
        {...baseProps}
        selectedClipIds={["clip-1"]}
        showPlatformSelector={false}
        captionSrt={`1
00:00:00,000 --> 00:00:01,000
Hello
`}
      />,
    );

    expect(screen.queryByText("Platform preset")).toBeNull();
    expect(screen.getByText("Export settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export 1 clip/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /download \.srt/i })).toBeInTheDocument();
  });

  it("keeps export disabled until clips are selected", () => {
    render(
      <ExportPanel
        {...baseProps}
        selectedClipIds={[]}
        showPlatformSelector={false}
      />,
    );

    expect(screen.getByRole("button", { name: /export 0 clips/i })).toBeDisabled();
  });
});
