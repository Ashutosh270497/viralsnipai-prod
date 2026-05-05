import {
  DEFAULT_PLATFORM_API_SCOPES,
  generatePlatformApiKey,
  hasRequiredScopes,
  hashPlatformApiKey,
  normalizePlatformApiScopes,
  safeCompareHash,
} from "@/lib/platform/api-keys";

describe("platform API keys", () => {
  it("generates a raw key and stores a hashable prefix", () => {
    const key = generatePlatformApiKey();

    expect(key.token).toMatch(/^vsai_live_/);
    expect(key.prefix).toBe(key.token.slice(0, 16));
    expect(key.keyHash).toBe(hashPlatformApiKey(key.token));
  });

  it("normalizes unknown scopes to defaults", () => {
    expect(normalizePlatformApiScopes(["bad", "projects:read"])).toEqual(["projects:read"]);
    expect(normalizePlatformApiScopes([])).toEqual(DEFAULT_PLATFORM_API_SCOPES);
  });

  it("supports all scope and scoped checks", () => {
    expect(hasRequiredScopes(["all"], ["exports:write"])).toBe(true);
    expect(hasRequiredScopes(["projects:read"], ["projects:read"])).toBe(true);
    expect(hasRequiredScopes(["projects:read"], ["exports:write"])).toBe(false);
  });

  it("compares hashes without accepting different lengths", () => {
    const hash = hashPlatformApiKey("secret");
    expect(safeCompareHash(hash, hash)).toBe(true);
    expect(safeCompareHash(hash, `${hash}0`)).toBe(false);
  });
});
