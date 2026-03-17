import { fireEvent, render, screen } from "@testing-library/react";

import {
  TranscriptEditor,
  clampCaptionEntriesToClipWindow,
  inferTrimRangeFromEditedText,
  buildWordTimeline,
  inferEditRangesFromEditedText,
} from "@/components/repurpose/transcript-editor";

describe("TranscriptEditor", () => {
  const captionSrt = `1
00:00:00,000 --> 00:00:02,000
Hello world from clippers
`;

  it("allows editing transcript text in the single transcript block", () => {
    const { container } = render(
      <TranscriptEditor
        clipId="clip-1"
        captionSrt={captionSrt}
        startMs={0}
        endMs={2_000}
        onSave={async () => {}}
      />
    );

    const editor = container.querySelector("[contenteditable='true']") as HTMLElement | null;
    expect(editor).toBeTruthy();
    if (!editor) return;

    editor.textContent = "Hello from clippers";
    fireEvent.blur(editor);

    expect(editor.textContent).toBe("Hello from clippers");
    expect(screen.queryByRole("button", { name: /delete word/i })).toBeNull();
  });

  it("shows single-segment mode instead of segmented rows", () => {
    render(
      <TranscriptEditor
        clipId="clip-1"
        captionSrt={captionSrt}
        startMs={0}
        endMs={2_000}
        onSave={async () => {}}
      />
    );

    expect(screen.getByText("Single segment")).toBeTruthy();
    expect(screen.queryByTitle("Remove this segment and trim clip")).toBeNull();
  });

  it("clips absolute-timeline captions to the active clip range", () => {
    const entries = [
      { index: 1, startMs: 8_000, endMs: 9_000, text: "before" },
      { index: 2, startMs: 10_100, endMs: 11_200, text: "inside one" },
      { index: 3, startMs: 11_300, endMs: 12_400, text: "inside two" },
      { index: 4, startMs: 15_000, endMs: 16_000, text: "after" },
    ];

    const clipped = clampCaptionEntriesToClipWindow(entries, 10_000, 13_000);

    expect(clipped).toHaveLength(2);
    expect(clipped[0].startMs).toBe(100);
    expect(clipped[0].text).toContain("inside");
    expect(clipped[1].endMs).toBe(2400);
  });

  it("infers transcript-driven trim range from edited text", () => {
    const timeline = buildWordTimeline([
      { index: 1, startMs: 0, endMs: 1_000, text: "alpha beta gamma delta" },
      { index: 2, startMs: 1_000, endMs: 2_000, text: "epsilon zeta eta theta" },
    ]);

    const inferred = inferTrimRangeFromEditedText("gamma delta epsilon zeta", timeline);

    expect(inferred).not.toBeNull();
    expect((inferred?.startMs ?? 0) > 0).toBe(true);
    expect((inferred?.endMs ?? 0) < 2_000).toBe(true);
  });

  it("infers internal keep ranges for transcript-driven cut edits", () => {
    const timeline = buildWordTimeline([
      { index: 1, startMs: 0, endMs: 1_000, text: "alpha beta gamma delta" },
      { index: 2, startMs: 1_000, endMs: 2_000, text: "epsilon zeta eta theta" },
    ]);

    const ranges = inferEditRangesFromEditedText("alpha beta eta theta", timeline);

    expect(ranges).not.toBeNull();
    expect(ranges?.length).toBeGreaterThan(1);
    expect((ranges?.[0].startMs ?? 0) >= 0).toBe(true);
  });
});
