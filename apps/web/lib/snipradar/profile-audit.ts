import type { XTweet, XUser } from "@/lib/types/snipradar";

export type ProfileAuditConfidence = "none" | "low" | "medium" | "high";
export type ProfileAuditStatus = "strong" | "watch" | "needs-work";

export interface ProfileAuditPillar {
  id: "profile" | "positioning" | "cadence" | "engagement";
  label: string;
  score: number;
  maxScore: number;
  status: ProfileAuditStatus;
  summary: string;
  recommendations: string[];
}

export interface ProfileAuditAiRewrite {
  label: string;
  text: string;
  rationale: string;
}

export interface ProfileAuditAiPinnedTweet {
  headline: string;
  bullets: string[];
  cta: string;
  rationale: string;
}

export interface ProfileAuditAiInsights {
  source: "ai" | "heuristic_fallback";
  executiveSummary: string;
  positioningAssessment: string;
  conversionAssessment: string;
  contentAssessment: string;
  strengths: string[];
  risks: string[];
  priorityFixes: string[];
  bioRewrites: ProfileAuditAiRewrite[];
  pinnedTweetAssessment: string;
  pinnedTweetRecommendation: ProfileAuditAiPinnedTweet;
  contentPillars: string[];
  next7DaysPlan: string[];
}

export interface ProfileAuditResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  confidence: ProfileAuditConfidence;
  headline: string;
  summary: string;
  quickWins: string[];
  stats: {
    followerCount: number;
    bioLength: number;
    recentPosts14d: number;
    avgEngagementRate: number;
    avgImpressions: number;
    replySharePct: number;
    hasPinnedTweet: boolean;
    hasProfileImage: boolean;
    hasUrl: boolean;
  };
  pillars: ProfileAuditPillar[];
  ai?: ProfileAuditAiInsights | null;
}

export interface ProfileAuditHistoryPoint {
  id: string;
  score: number;
  grade: "A" | "B" | "C" | "D";
  confidence: ProfileAuditConfidence;
  createdAt: string;
  deltaFromPrevious: number | null;
  pillars: Record<ProfileAuditPillar["id"], number>;
}

type BuildProfileAuditParams = {
  profile: XUser;
  tweets: XTweet[];
  selectedNiche?: string | null;
};

const CTA_PATTERNS = [
  "dm",
  "follow",
  "join",
  "subscribe",
  "newsletter",
  "book",
  "link",
  "download",
  "watch",
  "read",
];

const OUTCOME_PATTERNS = [
  "help",
  "build",
  "grow",
  "teach",
  "scale",
  "share",
  "learn",
  "founder",
  "creator",
  "operator",
  "marketer",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function toGrade(score: number): ProfileAuditResult["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function toStatus(score: number, maxScore: number): ProfileAuditStatus {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.55) return "watch";
  return "needs-work";
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isAuditConfidence(value: unknown): value is ProfileAuditConfidence {
  return value === "none" || value === "low" || value === "medium" || value === "high";
}

function isAuditGrade(value: unknown): value is ProfileAuditResult["grade"] {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function coercePillars(value: unknown): ProfileAuditPillar[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const id = candidate.id;
      if (
        id !== "profile" &&
        id !== "positioning" &&
        id !== "cadence" &&
        id !== "engagement"
      ) {
        return null;
      }

      const status = candidate.status;
      const normalizedStatus: ProfileAuditStatus =
        status === "strong" || status === "watch" || status === "needs-work"
          ? status
          : "needs-work";

      return {
        id,
        label: safeString(candidate.label, id),
        score: safeNumber(candidate.score),
        maxScore: safeNumber(candidate.maxScore, 1),
        status: normalizedStatus,
        summary: safeString(candidate.summary),
        recommendations: safeStringArray(candidate.recommendations).slice(0, 4),
      } satisfies ProfileAuditPillar;
    })
    .filter(Boolean) as ProfileAuditPillar[];
}

function coerceStats(value: unknown): ProfileAuditResult["stats"] {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    followerCount: safeNumber(candidate.followerCount),
    bioLength: safeNumber(candidate.bioLength),
    recentPosts14d: safeNumber(candidate.recentPosts14d),
    avgEngagementRate: safeNumber(candidate.avgEngagementRate),
    avgImpressions: safeNumber(candidate.avgImpressions),
    replySharePct: safeNumber(candidate.replySharePct),
    hasPinnedTweet: Boolean(candidate.hasPinnedTweet),
    hasProfileImage: Boolean(candidate.hasProfileImage),
    hasUrl: Boolean(candidate.hasUrl),
  };
}

function coerceAi(value: unknown): ProfileAuditAiInsights | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const source =
    candidate.source === "ai" || candidate.source === "heuristic_fallback"
      ? candidate.source
      : "heuristic_fallback";

  const pinnedTweetRecommendation =
    candidate.pinnedTweetRecommendation && typeof candidate.pinnedTweetRecommendation === "object"
      ? (candidate.pinnedTweetRecommendation as Record<string, unknown>)
      : null;

  return {
    source,
    executiveSummary: safeString(candidate.executiveSummary),
    positioningAssessment: safeString(candidate.positioningAssessment),
    conversionAssessment: safeString(candidate.conversionAssessment),
    contentAssessment: safeString(candidate.contentAssessment),
    strengths: safeStringArray(candidate.strengths).slice(0, 4),
    risks: safeStringArray(candidate.risks).slice(0, 4),
    priorityFixes: safeStringArray(candidate.priorityFixes).slice(0, 5),
    bioRewrites: Array.isArray(candidate.bioRewrites)
      ? candidate.bioRewrites
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const rewrite = item as Record<string, unknown>;
            const text = safeString(rewrite.text).slice(0, 160).trim();
            if (!text) return null;
            return {
              label: safeString(rewrite.label, `Option ${index + 1}`),
              text,
              rationale: safeString(rewrite.rationale),
            } satisfies ProfileAuditAiRewrite;
          })
          .filter(Boolean)
          .slice(0, 3) as ProfileAuditAiRewrite[]
      : [],
    pinnedTweetAssessment: safeString(candidate.pinnedTweetAssessment),
    pinnedTweetRecommendation: {
      headline: safeString(pinnedTweetRecommendation?.headline),
      bullets: safeStringArray(pinnedTweetRecommendation?.bullets).slice(0, 4),
      cta: safeString(pinnedTweetRecommendation?.cta),
      rationale: safeString(pinnedTweetRecommendation?.rationale),
    },
    contentPillars: safeStringArray(candidate.contentPillars).slice(0, 4),
    next7DaysPlan: safeStringArray(candidate.next7DaysPlan).slice(0, 7),
  };
}

function buildNicheTokens(selectedNiche?: string | null) {
  return normalizeText(selectedNiche)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function countOriginalPostsLast14d(tweets: XTweet[]) {
  const windowStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return tweets.filter((tweet) => {
    const publishedAt = new Date(tweet.created_at).getTime();
    if (Number.isNaN(publishedAt) || publishedAt < windowStart) return false;
    const isReply =
      tweet.referenced_tweets?.some((reference) => reference.type === "replied_to") ?? false;
    return !isReply;
  }).length;
}

function computeReplyShare(tweets: XTweet[]) {
  if (tweets.length === 0) return 0;
  const replies = tweets.filter(
    (tweet) =>
      tweet.referenced_tweets?.some((reference) => reference.type === "replied_to") ?? false
  ).length;
  return Math.round((replies / tweets.length) * 100);
}

function computeEngagementStats(tweets: XTweet[]) {
  const rows = tweets
    .map((tweet) => {
      const metrics = tweet.public_metrics;
      const impressions = metrics?.impression_count ?? 0;
      if (impressions <= 0) return null;
      const engagement =
        (metrics?.like_count ?? 0) +
        (metrics?.retweet_count ?? 0) * 2 +
        (metrics?.reply_count ?? 0) * 2.5;
      return {
        impressions,
        engagementRate: (engagement / impressions) * 100,
      };
    })
    .filter(Boolean) as Array<{ impressions: number; engagementRate: number }>;

  if (rows.length === 0) {
    return {
      avgEngagementRate: 0,
      avgImpressions: 0,
      sampleCount: 0,
    };
  }

  return {
    avgEngagementRate: round(
      rows.reduce((sum, row) => sum + row.engagementRate, 0) / rows.length
    ),
    avgImpressions: Math.round(
      rows.reduce((sum, row) => sum + row.impressions, 0) / rows.length
    ),
    sampleCount: rows.length,
  };
}

export function buildProfileAudit({
  profile,
  tweets,
  selectedNiche,
}: BuildProfileAuditParams): ProfileAuditResult {
  const bio = normalizeText(profile.description);
  const bioLength = bio.length;
  const nicheTokens = buildNicheTokens(selectedNiche);
  const hasPinnedTweet = Boolean(profile.pinned_tweet_id);
  const hasProfileImage = Boolean(profile.profile_image_url);
  const hasUrl = Boolean(profile.url);
  const hasBio = bioLength > 0;
  const hasCTA = hasUrl || CTA_PATTERNS.some((pattern) => bio.includes(pattern));
  const hasOutcomeSignal = OUTCOME_PATTERNS.some((pattern) => bio.includes(pattern));
  const mentionsAudience = bio.includes("for ") || bio.includes(" helping ") || bio.includes(" i ");
  const nicheHits = nicheTokens.filter((token) => bio.includes(token) || normalizeText(profile.name).includes(token));
  const nicheAlignment = nicheTokens.length === 0 ? 1 : nicheHits.length / nicheTokens.length;

  const recentPosts14d = countOriginalPostsLast14d(tweets);
  const replySharePct = computeReplyShare(tweets);
  const engagement = computeEngagementStats(tweets);

  let profileScore = 0;
  const profileRecommendations: string[] = [];
  if (hasProfileImage) profileScore += 6;
  else profileRecommendations.push("Add a clear profile photo or brand mark.");
  if (hasBio) profileScore += 8;
  else profileRecommendations.push("Add a bio that states who you help and what outcome you deliver.");
  if (bioLength >= 60 && bioLength <= 160) profileScore += 6;
  else if (hasBio) profileRecommendations.push("Tighten your bio to a sharper 60-160 character promise.");
  if (hasCTA) profileScore += 5;
  else profileRecommendations.push("Add one CTA in your bio or URL so profile visits have a next step.");
  if (hasPinnedTweet) profileScore += 5;
  else profileRecommendations.push("Pin a proof-led post or starter thread so new visitors see your best work first.");

  let positioningScore = 0;
  const positioningRecommendations: string[] = [];
  if (nicheAlignment >= 0.75) positioningScore += 11;
  else if (nicheAlignment >= 0.35) positioningScore += 7;
  else positioningRecommendations.push("State your niche directly in the bio so your positioning is obvious.");
  if (hasOutcomeSignal) positioningScore += 7;
  else positioningRecommendations.push("Rewrite the bio around a specific outcome you help people achieve.");
  if (mentionsAudience) positioningScore += 7;
  else positioningRecommendations.push("Name the audience you serve or the point of view you publish from.");

  let cadenceScore = 0;
  const cadenceRecommendations: string[] = [];
  if (recentPosts14d >= 10) cadenceScore = 20;
  else if (recentPosts14d >= 6) cadenceScore = 15;
  else if (recentPosts14d >= 3) cadenceScore = 10;
  else cadenceScore = 4;
  if (recentPosts14d < 6) {
    cadenceRecommendations.push("Raise your posting cadence to at least 4-6 original posts every 14 days.");
  }
  if (replySharePct < 10) {
    cadenceRecommendations.push("Increase reply volume to create more top-of-funnel discovery.");
  } else if (replySharePct > 65) {
    cadenceRecommendations.push("Reduce reply-heavy activity and publish more original posts to build authority.");
  }

  let engagementScore = 0;
  const engagementRecommendations: string[] = [];
  if (engagement.avgEngagementRate >= 4) engagementScore += 15;
  else if (engagement.avgEngagementRate >= 2) engagementScore += 11;
  else if (engagement.avgEngagementRate >= 1) engagementScore += 7;
  else engagementScore += 3;

  if (engagement.avgImpressions >= 1000) engagementScore += 10;
  else if (engagement.avgImpressions >= 300) engagementScore += 7;
  else if (engagement.avgImpressions >= 75) engagementScore += 4;
  else engagementScore += 2;

  if (engagement.sampleCount < 3) {
    engagementRecommendations.push("Publish more posts through SnipRadar so the audit can trust live engagement signals.");
  } else if (engagement.avgEngagementRate < 2) {
    engagementRecommendations.push("Test stronger hooks and clearer opinions to lift replies and reposts.");
  }
  if (engagement.avgImpressions < 300) {
    engagementRecommendations.push("Use a pinned proof post plus more consistent publishing to increase profile-to-feed conversion.");
  }

  const pillars: ProfileAuditPillar[] = [
    {
      id: "profile",
      label: "Profile Setup",
      score: clamp(profileScore, 0, 30),
      maxScore: 30,
      status: toStatus(profileScore, 30),
      summary:
        hasBio && hasCTA && hasPinnedTweet
          ? "Your profile has the main conversion assets in place."
          : "Your profile can convert visits better with stronger setup and clearer next steps.",
      recommendations: profileRecommendations.slice(0, 2),
    },
    {
      id: "positioning",
      label: "Positioning",
      score: clamp(positioningScore, 0, 25),
      maxScore: 25,
      status: toStatus(positioningScore, 25),
      summary:
        nicheAlignment >= 0.75
          ? "Your niche and audience are fairly clear from the profile."
          : "Your positioning is still too generic for fast follower conversion.",
      recommendations: positioningRecommendations.slice(0, 2),
    },
    {
      id: "cadence",
      label: "Cadence",
      score: clamp(cadenceScore, 0, 20),
      maxScore: 20,
      status: toStatus(cadenceScore, 20),
      summary:
        recentPosts14d >= 6
          ? "Your recent posting activity is healthy enough to create learning loops."
          : "Posting volume is too light to compound growth consistently.",
      recommendations: cadenceRecommendations.slice(0, 2),
    },
    {
      id: "engagement",
      label: "Engagement Health",
      score: clamp(engagementScore, 0, 25),
      maxScore: 25,
      status: toStatus(engagementScore, 25),
      summary:
        engagement.sampleCount >= 3
          ? "Live engagement signals are available and can guide better decisions."
          : "This score is low-confidence until more posts collect impressions.",
      recommendations: engagementRecommendations.slice(0, 2),
    },
  ];

  const score = pillars.reduce((sum, pillar) => sum + pillar.score, 0);
  const confidence: ProfileAuditConfidence =
    engagement.sampleCount >= 12
      ? "high"
      : engagement.sampleCount >= 5
        ? "medium"
        : engagement.sampleCount >= 1
          ? "low"
          : "none";

  const allRecommendations = pillars.flatMap((pillar) => pillar.recommendations);
  const quickWins = Array.from(new Set(allRecommendations)).slice(0, 4);
  const grade = toGrade(score);
  const headline =
    score >= 80
      ? "Strong base. Focus on compounding winners."
      : score >= 65
        ? "Solid account, but profile conversion can improve."
        : "Biggest upside is still in profile clarity and consistency.";
  const summary =
    confidence === "none"
      ? "Your profile setup is being scored, but engagement confidence is still limited because live post metrics are sparse."
      : `Your strongest area is ${pillars
          .slice()
          .sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0]
          .label.toLowerCase()}, while the main constraint is ${pillars
          .slice()
          .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0]
          .label.toLowerCase()}.`;

  return {
    score,
    grade,
    confidence,
    headline,
    summary,
    quickWins,
    stats: {
      followerCount: profile.public_metrics?.followers_count ?? 0,
      bioLength,
      recentPosts14d,
      avgEngagementRate: engagement.avgEngagementRate,
      avgImpressions: engagement.avgImpressions,
      replySharePct,
      hasPinnedTweet,
      hasProfileImage,
      hasUrl,
    },
    pillars,
  };
}

export function buildProfileAuditFingerprint(audit: ProfileAuditResult) {
  return JSON.stringify({
    score: audit.score,
    grade: audit.grade,
    confidence: audit.confidence,
    quickWins: audit.quickWins.slice(0, 4),
    stats: audit.stats,
    pillars: audit.pillars.map((pillar) => ({
      id: pillar.id,
      score: pillar.score,
      status: pillar.status,
      recommendations: pillar.recommendations,
    })),
    ai: audit.ai
      ? {
          source: audit.ai.source,
          priorityFixes: audit.ai.priorityFixes.slice(0, 5),
          next7DaysPlan: audit.ai.next7DaysPlan.slice(0, 7),
          bioRewrites: audit.ai.bioRewrites.map((rewrite) => rewrite.text),
          pinnedTweetAssessment: audit.ai.pinnedTweetAssessment,
        }
      : null,
  });
}

export function restoreProfileAuditFromSnapshot(input: {
  score: number;
  grade: string;
  confidence: string;
  headline: string;
  summary: string;
  quickWins: string[];
  stats: unknown;
  pillars: unknown;
  ai: unknown;
}): ProfileAuditResult {
  const pillars = coercePillars(input.pillars);
  return {
    score: safeNumber(input.score),
    grade: isAuditGrade(input.grade) ? input.grade : "D",
    confidence: isAuditConfidence(input.confidence) ? input.confidence : "none",
    headline: safeString(input.headline),
    summary: safeString(input.summary),
    quickWins: safeStringArray(input.quickWins).slice(0, 4),
    stats: coerceStats(input.stats),
    pillars,
    ai: coerceAi(input.ai),
  };
}

export function buildProfileAuditHistory(
  snapshots: Array<{
    id: string;
    score: number;
    grade: string;
    confidence: string;
    createdAt: Date | string;
    pillars: unknown;
  }>
): ProfileAuditHistoryPoint[] {
  const ordered = snapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );

  return ordered.map((snapshot, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    const pillars = coercePillars(snapshot.pillars);
    return {
      id: snapshot.id,
      score: safeNumber(snapshot.score),
      grade: isAuditGrade(snapshot.grade) ? snapshot.grade : "D",
      confidence: isAuditConfidence(snapshot.confidence)
        ? snapshot.confidence
        : "none",
      createdAt: new Date(snapshot.createdAt).toISOString(),
      deltaFromPrevious:
        previous && Number.isFinite(previous.score)
          ? safeNumber(snapshot.score) - safeNumber(previous.score)
          : null,
      pillars: {
        profile: pillars.find((pillar) => pillar.id === "profile")?.score ?? 0,
        positioning: pillars.find((pillar) => pillar.id === "positioning")?.score ?? 0,
        cadence: pillars.find((pillar) => pillar.id === "cadence")?.score ?? 0,
        engagement: pillars.find((pillar) => pillar.id === "engagement")?.score ?? 0,
      },
    };
  });
}
