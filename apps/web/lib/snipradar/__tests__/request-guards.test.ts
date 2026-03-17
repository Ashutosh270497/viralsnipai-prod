import {
  consumeSnipRadarRateLimit,
  timingSafeSecretEqual,
} from "@/lib/snipradar/request-guards";

describe("request-guards", () => {
  const originalNow = Date.now;

  afterEach(() => {
    global.Date.now = originalNow;
  });

  it("enforces cooldown-style single-hit windows", () => {
    global.Date.now = jest.fn(() => 1_000);

    const first = consumeSnipRadarRateLimit("test:cooldown", "user-1", [
      { name: "cooldown", windowMs: 10_000, maxHits: 1 },
    ]);
    expect(first.allowed).toBe(true);

    const second = consumeSnipRadarRateLimit("test:cooldown", "user-1", [
      { name: "cooldown", windowMs: 10_000, maxHits: 1 },
    ]);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSec).toBeGreaterThan(0);
    expect(second.violatedRule).toBe("cooldown");
  });

  it("enforces burst limits independently of a larger window", () => {
    const now = jest.fn<number, []>()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(4_000);
    global.Date.now = now;

    const rules = [
      { name: "cooldown", windowMs: 60_000, maxHits: 10 },
      { name: "burst", windowMs: 5_000, maxHits: 3 },
    ];

    expect(consumeSnipRadarRateLimit("test:burst", "user-2", rules).allowed).toBe(true);
    expect(consumeSnipRadarRateLimit("test:burst", "user-2", rules).allowed).toBe(true);
    expect(consumeSnipRadarRateLimit("test:burst", "user-2", rules).allowed).toBe(true);

    const blocked = consumeSnipRadarRateLimit("test:burst", "user-2", rules);
    expect(blocked.allowed).toBe(false);
    expect(blocked.violatedRule).toBe("burst");
  });

  it("compares machine secrets in constant-time-safe fashion", () => {
    expect(timingSafeSecretEqual("secret-123", "secret-123")).toBe(true);
    expect(timingSafeSecretEqual("secret-123", "secret-124")).toBe(false);
    expect(timingSafeSecretEqual("short", "longer")).toBe(false);
    expect(timingSafeSecretEqual(null, "value")).toBe(false);
  });
});
