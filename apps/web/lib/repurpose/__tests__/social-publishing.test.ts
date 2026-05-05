import {
  MockPublisherAdapter,
  SOCIAL_PLATFORMS,
  generateShareToken,
  normalizeHashtags,
  platformGuidance,
  platformLabel,
  socialPostDraftSchema,
} from "@/lib/repurpose/social-publishing";

describe("social publishing foundation", () => {
  it("supports the V1 social platforms", () => {
    expect(SOCIAL_PLATFORMS).toEqual([
      "youtube_shorts",
      "instagram_reels",
      "tiktok",
      "x",
      "linkedin",
      "facebook_reels",
    ]);
  });

  it("validates social post drafts", () => {
    const parsed = socialPostDraftSchema.safeParse({
      projectId: "project-1",
      clipId: "clip-1",
      platform: "linkedin",
      title: "A useful clip",
      hashtags: ["#ai", "video"],
    });

    expect(parsed.success).toBe(true);
  });

  it("normalizes hashtags safely", () => {
    expect(normalizeHashtags(["ai", "#video", "", "  launch  "])).toEqual([
      "#ai",
      "#video",
      "#launch",
    ]);
  });

  it("creates URL-safe share tokens", () => {
    const token = generateShareToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("labels platforms and returns guidance", () => {
    expect(platformLabel("youtube_shorts")).toBe("YouTube Shorts");
    expect(platformGuidance("x")).toContain("Short");
  });

  it("mock publisher publishes immediately or schedules future posts", async () => {
    const adapter = new MockPublisherAdapter();
    await expect(adapter.validateConnection("user-1", "tiktok")).resolves.toEqual({ ok: true });
    await expect(adapter.publish({ id: "post-1", platform: "tiktok" })).resolves.toMatchObject({
      status: "published",
      externalId: "mock_post-1",
    });
    await expect(
      adapter.publish({
        id: "post-2",
        platform: "tiktok",
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).resolves.toMatchObject({ status: "scheduled" });
  });
});
