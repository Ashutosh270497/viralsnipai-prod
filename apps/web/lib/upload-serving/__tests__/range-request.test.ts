import { isInsideDirectory, parseHttpRangeHeader } from "@/lib/upload-serving/range-request";

describe("parseHttpRangeHeader", () => {
  it("parses bounded byte ranges", () => {
    expect(parseHttpRangeHeader("bytes=0-99", 1000)).toEqual({
      ok: true,
      start: 0,
      end: 99,
      contentLength: 100,
    });
  });

  it("parses open-ended byte ranges", () => {
    expect(parseHttpRangeHeader("bytes=500-", 1000)).toEqual({
      ok: true,
      start: 500,
      end: 999,
      contentLength: 500,
    });
  });

  it("parses suffix byte ranges", () => {
    expect(parseHttpRangeHeader("bytes=-200", 1000)).toEqual({
      ok: true,
      start: 800,
      end: 999,
      contentLength: 200,
    });
  });

  it("rejects invalid ranges", () => {
    expect(parseHttpRangeHeader("bytes=1000-1200", 1000)).toEqual({ ok: false, status: 416 });
    expect(parseHttpRangeHeader("items=0-10", 1000)).toEqual({ ok: false, status: 416 });
  });

  it("guards upload path traversal", () => {
    expect(isInsideDirectory("/tmp/uploads", "/tmp/uploads/previews/a.mp4", "/")).toBe(true);
    expect(isInsideDirectory("/tmp/uploads", "/tmp/uploads-evil/a.mp4", "/")).toBe(false);
  });
});
