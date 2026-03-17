import {
  getCaptionQuality,
  hasUsableCaptionSrt,
  isPlaceholderCaptionText,
} from "@/lib/caption-quality";

describe("caption-quality", () => {
  it("treats Hindi/Devanagari text as non-placeholder", () => {
    const text = "यह एक परीक्षण वाक्य है";
    expect(isPlaceholderCaptionText(text)).toBe(false);
  });

  it("treats symbol-only strings as placeholder", () => {
    expect(isPlaceholderCaptionText("... --- !!!")).toBe(true);
    expect(isPlaceholderCaptionText("___")).toBe(true);
  });

  it("returns transcript_ready for valid non-English SRT", () => {
    const srt = `1
00:00:00,000 --> 00:00:01,400
यह एक परीक्षण वाक्य है

2
00:00:01,450 --> 00:00:02,900
यह दूसरा वाक्य है
`;

    const quality = getCaptionQuality(srt);
    expect(quality.isUsable).toBe(true);
    expect(quality.tier).toBe("transcript_ready");
    expect(hasUsableCaptionSrt(srt)).toBe(true);
  });

  it("returns needs_cleanup for mixed valid and placeholder content", () => {
    const srt = `1
00:00:00,000 --> 00:00:01,000
[Generated content]

2
00:00:01,000 --> 00:00:02,100
Real insight line

3
00:00:02,100 --> 00:00:03,300
Captions unavailable
`;

    const quality = getCaptionQuality(srt);
    expect(quality.tier).toBe("needs_cleanup");
    expect(quality.isUsable).toBe(false);
    expect(quality.validCount).toBe(1);
    expect(quality.totalCount).toBe(3);
  });
});
