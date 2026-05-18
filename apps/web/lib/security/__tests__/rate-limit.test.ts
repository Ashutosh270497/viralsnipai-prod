import {
  consumeV1RateLimit,
  V1_RATE_LIMITS,
} from "@/lib/security/rate-limit";

describe("consumeV1RateLimit", () => {
  it("blocks after the configured threshold and returns headers", async () => {
    const request = {
      headers: new Headers({ "x-forwarded-for": `127.0.0.${Date.now()}` }),
    } as Request;
    const routeKey = `test-${Date.now()}`;

    for (let index = 0; index < 5; index += 1) {
      const result = await consumeV1RateLimit({
        request,
        routeKey,
        rules: V1_RATE_LIMITS.SIGNUP,
      });
      expect(result.allowed).toBe(true);
      expect(result.headers["X-RateLimit-Limit"]).toBe("5");
    }

    const blocked = await consumeV1RateLimit({
      request,
      routeKey,
      rules: V1_RATE_LIMITS.SIGNUP,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.headers["Retry-After"]).toBeTruthy();
  });
});
