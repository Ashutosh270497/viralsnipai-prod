import { assessSourceQualityForUi } from "@/components/repurpose/source-quality-notice";

describe("assessSourceQualityForUi", () => {
  it("warns for low-resolution landscape sources reframed to vertical", () => {
    const assessment = assessSourceQualityForUi({
      sourceWidth: 640,
      sourceHeight: 360,
      targetWidth: 1080,
      targetHeight: 1920,
    });

    expect(assessment.level).toBe("low");
    expect(assessment.shouldWarn).toBe(true);
    expect(assessment.renderMode).toBe("blur_background");
    expect(assessment.message).toContain("640x360");
  });

  it("does not warn for high-quality vertical sources", () => {
    const assessment = assessSourceQualityForUi({
      sourceWidth: 1080,
      sourceHeight: 1920,
      targetWidth: 1080,
      targetHeight: 1920,
    });

    expect(assessment.level).toBe("good");
    expect(assessment.shouldWarn).toBe(false);
  });
});
