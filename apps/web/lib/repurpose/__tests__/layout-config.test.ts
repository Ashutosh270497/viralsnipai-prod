import {
  aspectRatioToClipOutputRatio,
  buildCenteredCropBox,
  layoutConfigToReframePlan,
  normalizeClipLayoutConfig,
} from "@/lib/repurpose/layout-config";

describe("layout-config", () => {
  it("normalizes a manual layout config safely", () => {
    const config = normalizeClipLayoutConfig({
      preset: "manual_crop",
      aspectRatio: "4:5",
      cropBox: { x: 0.8, y: -1, width: 0.4, height: 1.2 },
      backgroundMode: "crop",
      blurBackground: false,
      borderRadius: 99,
      padding: -20,
    });

    expect(config.preset).toBe("manual_crop");
    expect(config.aspectRatio).toBe("4:5");
    expect(config.cropBox.x).toBeLessThanOrEqual(0.6);
    expect(config.cropBox.y).toBe(0);
    expect(config.cropBox.height).toBe(1);
    expect(config.borderRadius).toBe(48);
    expect(config.padding).toBe(0);
  });

  it("builds centered crop boxes for platform ratios", () => {
    const vertical = buildCenteredCropBox("9:16", 16 / 9);
    const square = buildCenteredCropBox("1:1", 16 / 9);
    const landscape = buildCenteredCropBox("16:9", 16 / 9);

    expect(vertical.width).toBeLessThan(square.width);
    expect(square.width).toBeLessThan(landscape.width);
    expect(landscape).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("converts persisted layout into a renderable reframe plan", () => {
    const config = normalizeClipLayoutConfig({
      preset: "manual_crop",
      aspectRatio: "9:16",
      cropBox: { x: 0.2, y: 0, width: 0.45, height: 1 },
      backgroundMode: "crop",
      reframeConfidence: "high",
      reason: "Manual speaker crop",
    });

    const plan = layoutConfigToReframePlan(config, 9 / 16);

    expect(plan?.ratio).toBe("9:16");
    expect(plan?.mode).toBe("center_crop");
    expect(plan?.manualCropBox).toEqual(config.cropBox);
    expect(plan?.confidence).toBe("high");
  });

  it("maps supported output ratios", () => {
    expect(aspectRatioToClipOutputRatio(9 / 16)).toBe("9:16");
    expect(aspectRatioToClipOutputRatio(1)).toBe("1:1");
    expect(aspectRatioToClipOutputRatio(4 / 5)).toBe("4:5");
    expect(aspectRatioToClipOutputRatio(16 / 9)).toBe("16:9");
  });
});
