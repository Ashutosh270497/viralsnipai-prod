import { sanitizeInternalRedirect } from "@/lib/security/safe-redirect";

describe("sanitizeInternalRedirect", () => {
  it("allows internal paths with query and hash", () => {
    expect(sanitizeInternalRedirect("/repurpose?projectId=123#clips")).toBe(
      "/repurpose?projectId=123#clips",
    );
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.com", "/repurpose")).toBe("/repurpose");
    expect(sanitizeInternalRedirect("//evil.com", "/repurpose")).toBe("/repurpose");
    expect(sanitizeInternalRedirect("\\\\evil.com", "/repurpose")).toBe("/repurpose");
  });
});
