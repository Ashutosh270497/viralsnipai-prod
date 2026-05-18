import { sanitizeForLog } from "@/lib/logger/redact";

describe("sanitizeForLog", () => {
  it("redacts secrets and long generated text", () => {
    const output = sanitizeForLog({
      password: "secret",
      accessToken: "token",
      captionSrt: "hello world",
      safe: "small",
      longValue: "x".repeat(600),
    }) as Record<string, unknown>;

    expect(output.password).toBe("[REDACTED]");
    expect(output.accessToken).toBe("[REDACTED]");
    expect(output.captionSrt).toEqual({ redacted: true, length: 11 });
    expect(output.safe).toBe("small");
    expect(output.longValue).toEqual({
      redacted: true,
      length: 600,
      preview: "x".repeat(80),
    });
  });
});
