export type KeywordScript = "latin" | "devanagari" | "mixed" | "unknown";

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const LATIN_REGEX = /[A-Za-z]/;

export function detectKeywordScript(keyword: string): KeywordScript {
  const hasDevanagari = DEVANAGARI_REGEX.test(keyword);
  const hasLatin = LATIN_REGEX.test(keyword);

  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "devanagari";
  if (hasLatin) return "latin";
  return "unknown";
}

export function normalizeKeywordForLocale(keyword: string): string {
  return keyword
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function generateLocaleVariants(input: {
  keyword: string;
  country: string;
  language: string;
}): string[] {
  const keyword = normalizeKeywordForLocale(input.keyword);
  const variants = new Set<string>([keyword]);

  if (input.country.toUpperCase() === "IN") {
    variants.add(`${keyword} india`);
    variants.add(`${keyword} 2026`);
    if (input.language.toLowerCase() === "hi") {
      variants.add(`${keyword} hindi`);
      variants.add(`${keyword} in hindi`);
    }
  }

  return [...variants].filter(Boolean);
}

export function dedupeKeywordsLocaleAware(keywords: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const keyword of keywords) {
    const normalized = normalizeKeywordForLocale(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

export function clusterKeywordsByRoot(keywords: string[]): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  for (const keyword of keywords) {
    const tokens = keyword.split(" ").filter(Boolean);
    const root = tokens.slice(0, 2).join(" ");
    if (!root) continue;
    if (!clusters[root]) clusters[root] = [];
    clusters[root].push(keyword);
  }
  return clusters;
}

