import {
  buildProfileAudit,
  buildProfileAuditFingerprint,
  buildProfileAuditHistory,
  restoreProfileAuditFromSnapshot,
} from "@/lib/snipradar/profile-audit";

describe("buildProfileAudit", () => {
  it("rewards complete profiles with healthy cadence and engagement", () => {
    const result = buildProfileAudit({
      selectedNiche: "ai founders",
      profile: {
        id: "user_1",
        username: "builder",
        name: "AI Founder",
        description: "Helping AI founders grow with better product positioning. Join the newsletter.",
        profile_image_url: "https://example.com/avatar.png",
        pinned_tweet_id: "tweet_1",
        url: "https://example.com",
        public_metrics: {
          followers_count: 4200,
          following_count: 600,
          tweet_count: 1800,
        },
      },
      tweets: Array.from({ length: 8 }, (_, idx) => ({
        id: `tweet_${idx}`,
        text: `Post ${idx}`,
        author_id: "user_1",
        created_at: new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString(),
        public_metrics: {
          like_count: 80,
          retweet_count: 15,
          reply_count: 12,
          impression_count: 2500,
          bookmark_count: 10,
          quote_count: 2,
        },
      })),
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toMatch(/[AB]/);
    expect(result.pillars.find((pillar) => pillar.id === "profile")?.status).toBe("strong");
  });

  it("surfaces obvious setup and cadence issues", () => {
    const result = buildProfileAudit({
      selectedNiche: "creator education",
      profile: {
        id: "user_2",
        username: "generic",
        name: "John",
        description: "building stuff",
        public_metrics: {
          followers_count: 120,
          following_count: 300,
          tweet_count: 20,
        },
      },
      tweets: [],
    });

    expect(result.score).toBeLessThan(60);
    expect(result.grade).toMatch(/[CD]/);
    expect(result.quickWins.length).toBeGreaterThan(0);
    expect(result.pillars.find((pillar) => pillar.id === "profile")?.status).toBe("needs-work");
  });

  it("restores a persisted audit snapshot and builds trend deltas", () => {
    const audit = buildProfileAudit({
      selectedNiche: "ai founders",
      profile: {
        id: "user_3",
        username: "restored",
        name: "Restored",
        description: "Helping founders grow with better distribution and positioning. Join the waitlist.",
        profile_image_url: "https://example.com/avatar.png",
        pinned_tweet_id: "tweet_1",
        url: "https://example.com",
        public_metrics: {
          followers_count: 1800,
          following_count: 250,
          tweet_count: 400,
        },
      },
      tweets: [
        {
          id: "tweet_1",
          text: "A solid post",
          author_id: "user_3",
          created_at: new Date().toISOString(),
          public_metrics: {
            like_count: 35,
            retweet_count: 8,
            reply_count: 6,
            impression_count: 1400,
            bookmark_count: 3,
            quote_count: 1,
          },
        },
      ],
    });

    const fingerprint = buildProfileAuditFingerprint(audit);
    expect(fingerprint).toContain('"score"');

    const restored = restoreProfileAuditFromSnapshot({
      score: audit.score,
      grade: audit.grade,
      confidence: audit.confidence,
      headline: audit.headline,
      summary: audit.summary,
      quickWins: audit.quickWins,
      stats: audit.stats,
      pillars: audit.pillars,
      ai: null,
    });

    expect(restored.score).toBe(audit.score);
    expect(restored.pillars).toHaveLength(4);

    const history = buildProfileAuditHistory([
      {
        id: "older",
        score: 61,
        grade: "C",
        confidence: "low",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        pillars: audit.pillars.map((pillar) => ({ ...pillar, score: Math.max(1, pillar.score - 2) })),
      },
      {
        id: "latest",
        score: 68,
        grade: "B",
        confidence: "medium",
        createdAt: new Date("2026-03-06T10:00:00.000Z"),
        pillars: audit.pillars,
      },
    ]);

    expect(history).toHaveLength(2);
    expect(history[1]?.deltaFromPrevious).toBe(7);
    expect(history[1]?.pillars.profile).toBeGreaterThan(0);
  });
});
