export type SnipRadarStarterNiche = {
  id: string;
  label: string;
  description: string;
  handles: string[];
};

export const SNIPRADAR_STARTER_NICHES: readonly SnipRadarStarterNiche[] = [
  {
    id: "ai founders",
    label: "AI founders",
    description: "Track builders, labs, and product voices shaping the AI conversation.",
    handles: ["OpenAI", "AnthropicAI", "GoogleAI", "sama", "ycombinator"],
  },
  {
    id: "creator growth",
    label: "Creator growth",
    description: "Study creators who consistently publish, package, and distribute strong ideas.",
    handles: ["thejustinwelsh", "ShaanVP", "sahilbloom", "DickieBush", "NicolasCole77"],
  },
  {
    id: "marketing growth",
    label: "Marketing growth",
    description: "Follow operators and brands who ship clear positioning, hooks, and conversion angles.",
    handles: ["randfish", "neilpatel", "HubSpot", "Semrush", "ahrefs"],
  },
  {
    id: "indie hacking",
    label: "Indie hacking",
    description: "Watch founders and makers who build in public and ship relentlessly.",
    handles: ["levelsio", "ycombinator", "naval", "dhh", "paulg"],
  },
  {
    id: "productivity systems",
    label: "Productivity systems",
    description: "Learn from accounts that turn systems, habits, and workflows into repeatable content.",
    handles: ["JamesClear", "AliAbdaal", "fortelabs", "NotionHQ", "zapier"],
  },
  {
    id: "engineering leadership",
    label: "Engineering leadership",
    description: "Track technical leaders discussing engineering leverage, teams, and product execution.",
    handles: ["addyosmani", "kentcdodds", "dan_abramov", "dhh", "swyx"],
  },
] as const;

const NICHE_KEYWORDS: Array<{ keywords: string[]; nicheId: string }> = [
  { nicheId: "ai founders", keywords: ["ai", "artificial intelligence", "llm", "agents", "saas"] },
  { nicheId: "creator growth", keywords: ["creator", "audience", "personal brand", "content", "twitter growth"] },
  { nicheId: "marketing growth", keywords: ["marketing", "growth", "seo", "demand gen", "distribution"] },
  { nicheId: "indie hacking", keywords: ["indie", "startup", "founder", "bootstrapped", "build in public"] },
  { nicheId: "productivity systems", keywords: ["productivity", "workflow", "systems", "habits", "ops"] },
  { nicheId: "engineering leadership", keywords: ["engineering", "developer", "software", "technical", "programming"] },
] as const;

function normalizeNiche(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function getSnipRadarStarterNiche(selectedNiche?: string | null) {
  const normalized = normalizeNiche(selectedNiche);

  const directMatch = SNIPRADAR_STARTER_NICHES.find((niche) => niche.id === normalized);
  if (directMatch) {
    return directMatch;
  }

  const keywordMatch = NICHE_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  );
  if (keywordMatch) {
    return SNIPRADAR_STARTER_NICHES.find((niche) => niche.id === keywordMatch.nicheId)!;
  }

  return SNIPRADAR_STARTER_NICHES[0];
}
