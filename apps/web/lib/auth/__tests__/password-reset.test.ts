import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/auth/password-reset";

describe("password reset helpers", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  });

  it("stores a hash instead of the raw token", () => {
    const token = createPasswordResetToken();

    expect(token.rawToken).toHaveLength(43);
    expect(token.tokenHash).toBe(hashPasswordResetToken(token.rawToken));
    expect(token.tokenHash).not.toBe(token.rawToken);
  });

  it("sets a 30 minute expiry window", () => {
    const before = Date.now();
    const token = createPasswordResetToken();
    const after = Date.now();

    expect(token.expiresAt.getTime()).toBeGreaterThanOrEqual(before + PASSWORD_RESET_TOKEN_TTL_MS);
    expect(token.expiresAt.getTime()).toBeLessThanOrEqual(after + PASSWORD_RESET_TOKEN_TTL_MS);
  });

  it("builds reset URLs from the configured app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.viralsnipai.com/";

    expect(buildPasswordResetUrl("abc.def")).toBe(
      "https://app.viralsnipai.com/new-password?token=abc.def",
    );
  });
});

