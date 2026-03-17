// ============================================
// Competition Score Algorithm for Keyword Research
// ============================================

interface CompetitionFactors {
  totalResults: number;
  topChannelSize: number; // avg subscriber count of top channels
  avgViews: number;
  uploadFrequency: number; // videos per month in this niche
  domainAuthority: number; // 1-100 how established top creators are
  videoAge: number; // average age of top videos in days
  engagementRate: number; // percentage
}

interface CompetitionResult {
  score: number; // 1-100
  difficulty: "easy" | "medium" | "hard";
  recommendation: string;
  breakdown: {
    saturationScore: number;
    authorityScore: number;
    engagementBarrier: number;
    freshnessScore: number;
    volumeScore: number;
  };
}

/**
 * Calculate a competition score from 1-100 based on multiple factors.
 * Lower score = less competition = easier to rank.
 */
export function calculateCompetitionScore(
  factors: CompetitionFactors
): CompetitionResult {
  const {
    totalResults,
    topChannelSize,
    avgViews,
    uploadFrequency,
    domainAuthority,
    videoAge,
    engagementRate,
  } = factors;

  // 1. Saturation Score (0-100): How many videos already exist
  const saturationScore = Math.min(
    100,
    Math.round((Math.log10(Math.max(totalResults, 1)) / 7) * 100)
  );

  // 2. Authority Score (0-100): How big are the top channels
  const authorityScore = Math.min(
    100,
    Math.round((Math.log10(Math.max(topChannelSize, 1)) / 7) * 100)
  );

  // 3. Engagement Barrier (0-100): How much engagement do top videos get
  const engagementBarrier = Math.min(
    100,
    Math.round(engagementRate * 10)
  );

  // 4. Freshness Score (0-100): Older content = opportunity for fresh content
  // Lower video age = more competition (active uploading), higher age = less active
  const freshnessScore =
    videoAge > 365
      ? 20 // Old content, opportunity
      : videoAge > 180
        ? 40
        : videoAge > 90
          ? 60
          : videoAge > 30
            ? 80
            : 100; // Very recent = very competitive

  // 5. Volume Score (0-100): Based on average views
  const volumeScore = Math.min(
    100,
    Math.round((Math.log10(Math.max(avgViews, 1)) / 6) * 100)
  );

  // Weighted average
  const weights = {
    saturation: 0.25,
    authority: 0.25,
    engagement: 0.15,
    freshness: 0.15,
    volume: 0.20,
  };

  const score = Math.round(
    saturationScore * weights.saturation +
      authorityScore * weights.authority +
      engagementBarrier * weights.engagement +
      freshnessScore * weights.freshness +
      volumeScore * weights.volume
  );

  // Clamp to 1-100
  const clampedScore = Math.max(1, Math.min(100, score));

  // Determine difficulty
  let difficulty: "easy" | "medium" | "hard";
  let recommendation: string;

  if (clampedScore <= 33) {
    difficulty = "easy";
    recommendation =
      "Low competition - great opportunity! Focus on consistent quality content and you can rank quickly. Target long-tail variations for even faster results.";
  } else if (clampedScore <= 66) {
    difficulty = "medium";
    recommendation =
      "Moderate competition - winnable with good strategy. Focus on unique angles, better thumbnails, and optimized titles. Consider collaborations to boost initial visibility.";
  } else {
    difficulty = "hard";
    recommendation =
      "High competition - requires strong differentiation. Consider targeting sub-niches or long-tail keywords first. Build authority gradually before tackling this keyword directly.";
  }

  return {
    score: clampedScore,
    difficulty,
    recommendation,
    breakdown: {
      saturationScore,
      authorityScore,
      engagementBarrier,
      freshnessScore,
      volumeScore,
    },
  };
}

/**
 * Calculate an opportunity score (1-100) by combining competition and search volume.
 * Higher = better opportunity.
 */
export function calculateOpportunityScore(
  competition: number,
  searchVolume: number
): number {
  // Normalize search volume to 0-100 scale (log scale)
  const volumeScore = Math.min(
    100,
    Math.round((Math.log10(Math.max(searchVolume, 1)) / 7) * 100)
  );

  // Opportunity = high volume + low competition
  // Invert competition (100 - competition) so low competition = high score
  const invertedCompetition = 100 - competition;

  // Weighted: volume matters slightly more than competition
  const opportunity = Math.round(
    volumeScore * 0.45 + invertedCompetition * 0.55
  );

  return Math.max(1, Math.min(100, opportunity));
}

/**
 * Estimate CPM based on niche and engagement metrics.
 * Returns estimated CPM in USD.
 */
export function estimateCPM(
  niche: string,
  engagementRate: number,
  avgViews: number
): number {
  // Base CPM rates by niche (USD)
  const nicheCPMRates: Record<string, number> = {
    finance: 12.0,
    insurance: 15.0,
    "real estate": 10.0,
    technology: 8.0,
    business: 9.0,
    marketing: 7.5,
    health: 6.5,
    education: 5.0,
    gaming: 3.5,
    entertainment: 4.0,
    lifestyle: 4.5,
    beauty: 5.5,
    fashion: 5.0,
    food: 4.0,
    travel: 6.0,
    fitness: 5.5,
    music: 2.5,
    comedy: 3.0,
    news: 4.5,
    sports: 4.0,
    automotive: 7.0,
    pets: 3.5,
    diy: 5.0,
    science: 5.5,
    crypto: 10.0,
    ai: 9.0,
    "software development": 8.5,
    photography: 4.5,
    art: 3.0,
  };

  // Find the best matching niche
  const normalizedNiche = niche.toLowerCase().trim();
  let baseCPM = 4.0; // default

  for (const [key, rate] of Object.entries(nicheCPMRates)) {
    if (
      normalizedNiche.includes(key) ||
      key.includes(normalizedNiche)
    ) {
      baseCPM = rate;
      break;
    }
  }

  // Adjust based on engagement rate
  // Higher engagement = higher CPM (advertisers pay more)
  const engagementMultiplier =
    engagementRate > 8
      ? 1.4
      : engagementRate > 5
        ? 1.2
        : engagementRate > 3
          ? 1.0
          : engagementRate > 1
            ? 0.85
            : 0.7;

  // Adjust based on average views (larger audience = slightly higher CPM)
  const viewsMultiplier =
    avgViews > 1000000
      ? 1.3
      : avgViews > 100000
        ? 1.15
        : avgViews > 10000
          ? 1.0
          : avgViews > 1000
            ? 0.9
            : 0.75;

  const estimatedCPM = baseCPM * engagementMultiplier * viewsMultiplier;

  return parseFloat(estimatedCPM.toFixed(2));
}

/**
 * Analyze the search intent behind a keyword.
 */
export function analyzeSearchIntent(
  keyword: string
): "informational" | "transactional" | "navigational" {
  const lower = keyword.toLowerCase().trim();

  // Navigational: looking for a specific brand/channel/site
  const navigationalPatterns = [
    /^(go to|visit|find|open|login|sign in)/,
    /\b(official|website|channel|account|app)\b/,
    /\b(youtube|twitch|tiktok|instagram|twitter)\b.*\b(channel|account|page)\b/,
  ];

  for (const pattern of navigationalPatterns) {
    if (pattern.test(lower)) return "navigational";
  }

  // Transactional: intent to buy/download/subscribe
  const transactionalPatterns = [
    /\b(buy|purchase|price|cost|cheap|affordable|deal|discount|coupon)\b/,
    /\b(download|install|subscribe|sign up|register|order)\b/,
    /\b(best|top|review|comparison|vs|versus|alternative)\b/,
    /\b(free|trial|premium|pro version)\b/,
  ];

  for (const pattern of transactionalPatterns) {
    if (pattern.test(lower)) return "transactional";
  }

  // Default: informational
  return "informational";
}

/**
 * Generate related keyword suggestions based on common patterns.
 */
export function generateRelatedKeywordSuggestions(
  keyword: string
): string[] {
  const suggestions: string[] = [];
  const kw = keyword.trim();

  // How-to variations
  suggestions.push(`how to ${kw}`);
  suggestions.push(`how to ${kw} for beginners`);
  suggestions.push(`how to ${kw} step by step`);

  // Best/Top variations
  suggestions.push(`best ${kw}`);
  suggestions.push(`best ${kw} ${new Date().getFullYear()}`);
  suggestions.push(`top 10 ${kw}`);
  suggestions.push(`top ${kw} tips`);

  // Question variations
  suggestions.push(`what is ${kw}`);
  suggestions.push(`why ${kw}`);
  suggestions.push(`is ${kw} worth it`);

  // Modifier variations
  suggestions.push(`${kw} tutorial`);
  suggestions.push(`${kw} guide`);
  suggestions.push(`${kw} tips and tricks`);
  suggestions.push(`${kw} for beginners`);
  suggestions.push(`${kw} vs`);
  suggestions.push(`${kw} review`);
  suggestions.push(`${kw} explained`);

  // Remove duplicates and the original keyword
  const unique = [...new Set(suggestions)].filter(
    (s) => s.toLowerCase() !== kw.toLowerCase()
  );

  return unique;
}
