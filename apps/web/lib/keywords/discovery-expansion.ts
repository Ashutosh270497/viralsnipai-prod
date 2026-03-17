import { normalizeKeywordForLocale } from "@/lib/keywords/localization";

const EN_QUESTION_PREFIXES = [
  "how to",
  "what is",
  "best",
  "why",
  "tips for",
];

const HI_QUESTION_PREFIXES = [
  "कैसे",
  "क्या है",
  "सबसे अच्छा",
  "क्यों",
];

const EN_INTENT_SUFFIXES = [
  "for beginners",
  "tutorial",
  "step by step",
  "tips",
  "strategy",
];

const HI_INTENT_SUFFIXES = [
  "शुरुआती के लिए",
  "ट्यूटोरियल",
  "टिप्स",
  "रणनीति",
];

const ALPHABET_SOUP_SEEDS = "abcdefghijklmnopqrstuvwxyz".split("");

function sanitizeKeyword(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeForDedup(input: string): string {
  return normalizeKeywordForLocale(input).toLowerCase();
}

function dedupeByLocale(candidates: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of candidates) {
    const keyword = sanitizeKeyword(raw);
    if (!keyword) continue;
    const normalized = normalizeForDedup(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(keyword);
  }
  return output;
}

export interface KeywordDiscoveryExpansion {
  queries: string[];
  truncated: boolean;
  generatedCount: number;
}

export function buildKeywordDiscoveryQueries(params: {
  keyword: string;
  language: string;
  maxExpansions: number;
}): KeywordDiscoveryExpansion {
  const seed = sanitizeKeyword(params.keyword);
  const max = Math.max(1, Math.min(24, Math.trunc(params.maxExpansions)));
  const isHindi = params.language.toLowerCase().startsWith("hi");

  const questionPrefixes = isHindi
    ? HI_QUESTION_PREFIXES
    : EN_QUESTION_PREFIXES;
  const intentSuffixes = isHindi
    ? HI_INTENT_SUFFIXES
    : EN_INTENT_SUFFIXES;

  const generated = [
    seed,
    ...questionPrefixes.map((prefix) => `${prefix} ${seed}`),
    ...intentSuffixes.map((suffix) => `${seed} ${suffix}`),
    ...ALPHABET_SOUP_SEEDS.map((letter) => `${seed} ${letter}`),
  ];

  const deduped = dedupeByLocale(generated);
  return {
    queries: deduped.slice(0, max),
    truncated: deduped.length > max,
    generatedCount: deduped.length,
  };
}

