process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret";

import {
  decryptSnipRadarSecret,
  encryptSnipRadarSecret,
  generateSnipRadarApiKey,
  normalizeSnipRadarApiScopes,
  normalizeSnipRadarWebhookEvents,
  signSnipRadarWebhookPayload,
} from "@/lib/snipradar/public-api";

describe("snipradar public api helpers", () => {
  it("generates API keys with the expected prefix and stable hash metadata", () => {
    const apiKey = generateSnipRadarApiKey();

    expect(apiKey.token.startsWith("sr_live_")).toBe(true);
    expect(apiKey.prefix.length).toBeGreaterThan(8);
    expect(apiKey.lastFour.length).toBe(4);
    expect(apiKey.keyHash).toHaveLength(64);
  });

  it("normalizes scopes and webhook events", () => {
    expect(normalizeSnipRadarApiScopes(["drafts:read", "drafts:read", "unknown"])).toEqual([
      "drafts:read",
    ]);
    expect(normalizeSnipRadarWebhookEvents(["winner.detected", "unknown"])).toEqual([
      "winner.detected",
    ]);
  });

  it("encrypts and decrypts webhook secrets", () => {
    const encrypted = encryptSnipRadarSecret("swhsec_test_secret");
    expect(encrypted).toContain("v1:");
    expect(decryptSnipRadarSecret(encrypted)).toBe("swhsec_test_secret");
  });

  it("signs webhook payloads with timestamp-bound HMAC", () => {
    const signature = signSnipRadarWebhookPayload({
      signingSecret: "swhsec_test_secret",
      timestamp: "1700000000",
      body: "{\"hello\":\"world\"}",
    });

    expect(signature.startsWith("v1=")).toBe(true);
    expect(signature).toHaveLength(67);
  });
});
