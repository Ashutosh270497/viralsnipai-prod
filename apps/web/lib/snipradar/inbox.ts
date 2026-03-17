export const RESEARCH_INBOX_ITEM_TYPES = ["tweet", "thread", "profile"] as const;
export type ResearchInboxItemType = (typeof RESEARCH_INBOX_ITEM_TYPES)[number];

export const RESEARCH_INBOX_STATUSES = [
  "new",
  "drafted",
  "tracked",
  "archived",
] as const;
export type ResearchInboxStatus = (typeof RESEARCH_INBOX_STATUSES)[number];

export type ResearchInboxRecord = {
  id: string;
  source: string;
  itemType: string;
  sourceUrl: string;
  xEntityId: string | null;
  title: string | null;
  text: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  status: string;
  labels: string[];
  note: string | null;
  generatedReply: string | null;
  generatedRemix: string | null;
  metadata: unknown;
  trackedAccountId: string | null;
  lastActionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeResearchInboxLabels(labels: string[]) {
  const unique = new Set<string>();

  for (const label of labels) {
    const normalized = compact(label).slice(0, 40);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= 8) break;
  }

  return Array.from(unique);
}

export function mergeResearchInboxLabels(existing: string[], additions: string[]) {
  return normalizeResearchInboxLabels([...existing, ...additions]);
}

function wordCount(value: string) {
  return compact(value).split(/\s+/).filter(Boolean).length;
}

const FALLBACK_STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "cant",
  "could",
  "do",
  "for",
  "from",
  "get",
  "has",
  "have",
  "here",
  "how",
  "if",
  "into",
  "is",
  "it",
  "its",
  "just",
  "leave",
  "latest",
  "make",
  "more",
  "not",
  "now",
  "off",
  "only",
  "or",
  "our",
  "out",
  "point",
  "real",
  "really",
  "same",
  "solve",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "update",
  "version",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
]);

function extractFallbackTerms(value: string) {
  return Array.from(
    new Set(
      compact(value)
        .toLowerCase()
        .match(/[a-z0-9]+/g) ?? []
    )
  ).filter((term) => term.length >= 4 && !FALLBACK_STOP_WORDS.has(term));
}

function cleanFallbackSourceText(value: string | null | undefined) {
  return compact(value ?? "")
    .replace(/\b(?:https?:\/\/|pic\.x\.com\/|t\.co\/)\S+/gi, "")
    .trim();
}

function clip(value: string, maxLength: number) {
  const cleaned = compact(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function coerceType(itemType: string): ResearchInboxItemType {
  if (RESEARCH_INBOX_ITEM_TYPES.includes(itemType as ResearchInboxItemType)) {
    return itemType as ResearchInboxItemType;
  }
  return "tweet";
}

function coerceStatus(status: string): ResearchInboxStatus {
  if (RESEARCH_INBOX_STATUSES.includes(status as ResearchInboxStatus)) {
    return status as ResearchInboxStatus;
  }
  return "new";
}

function buildSeedContext(item: Pick<ResearchInboxRecord, "title" | "text" | "authorUsername" | "note" | "itemType">) {
  return [
    item.title ? `Title: ${item.title}` : null,
    item.authorUsername ? `Author: @${item.authorUsername}` : null,
    item.text ? `Source:\n${item.text}` : null,
    item.note ? `Saved note:\n${item.note}` : null,
    item.itemType === "profile" ? "Turn this profile positioning into one original post angle." : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildResearchInboxDraftSeed(item: Pick<ResearchInboxRecord, "title" | "text" | "authorUsername" | "note" | "itemType">) {
  const context = buildSeedContext(item);
  const intro =
    item.itemType === "profile"
      ? "Write an original X post inspired by this creator profile and positioning."
      : item.itemType === "thread"
        ? "Turn this saved thread into one concise original X post with a sharper opinion."
        : "Write an original X post inspired by this saved X capture.";

  return `${intro}\n\n${context}\n\nKeep it original, specific, and suited for my audience. End with a clear payoff or CTA.`;
}

export function buildResearchInboxReplyFallback(
  item: Pick<ResearchInboxRecord, "title" | "text" | "authorUsername" | "itemType">,
  selectedNiche?: string | null
) {
  const text = cleanFallbackSourceText([item.title ?? "", item.text ?? ""].filter(Boolean).join(" ")).toLowerCase();
  const niche = selectedNiche?.trim().toLowerCase() ?? "";
  const terms = extractFallbackTerms(text);

  const sourceAwareFallback =
    (/\b(bot|agent|agi)\b/.test(text) && /\b(vada pav|delivery|support|customer|order|restaurant)\b/.test(text)
      ? "AGI can wait till support basics work."
      : null) ||
    (/\b(can'?t solve|leave alone)\b/.test(text) ? "Ground truth is still the harder benchmark." : null) ||
    (/\bdesktop\b/.test(text) && /\bdocs?|documentation\b/.test(text)
      ? "Desktop docs cut onboarding friction fast."
      : null) ||
    (/\bdesktop\b/.test(text) ? "Desktop support removes a lot of friction." : null) ||
    (/\bdocs?|documentation|guide\b/.test(text)
      ? "Good docs speed adoption more than most launches."
      : null) ||
    (/\bupdate|latest version|upgrade\b/.test(text)
      ? "The update loop matters as much as the launch."
      : null) ||
    (/\bclaude code\b/.test(text) ? "Claude Code on desktop tightens the workflow." : null) ||
    (/\bfree|preview|beta\b/.test(text) ? "Free in preview is an easy yes." : null) ||
    (/\blaunch|launched|ship|shipped\b/.test(text) ? "Fast launch, even stronger wedge." : null) ||
    (/\bsecurity|secure|vuln|review\b/.test(text)
      ? "Security review on by default is the move."
      : null) ||
    (/\bturn it on|enable|enabled|turn on\b/.test(text) ? "Hard to ignore while it's free." : null) ||
    (/\btrillion|billion|valuation|revenue|growth\b/.test(text)
      ? "The scale implication is the real story."
      : null) ||
    (/\bai|model|agent|llm|automation\b/.test(text)
      ? "The workflow shift matters more than the demo."
      : null) ||
    (terms.includes("pricing") ? "Pricing is the wedge people will notice first." : null) ||
    (terms.includes("install") ? "Install friction usually decides adoption." : null);

  const candidates = [
    item.itemType === "profile" ? "Specific positioning wins every time." : null,
    sourceAwareFallback,
    niche.includes("creator") ? "Distribution changes everything here." : null,
    terms[0] && terms[1]
      ? `${terms[0].charAt(0).toUpperCase()}${terms[0].slice(1)} is easier than fixing ${terms[1]}.`
      : null,
    terms[0]
      ? `${terms[0].charAt(0).toUpperCase()}${terms[0].slice(1)} is where reality shows up.`
      : null,
    /\bpricing|preview|free|beta\b/.test(text) ? "The pricing move does most of the work here." : null,
    /\bdocs?|documentation\b/.test(text) ? "Docs quality usually decides whether this sticks." : null,
    /\bdesktop\b/.test(text) ? "Desktop changes the habit loop fast." : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const best = candidates.find((candidate) => wordCount(candidate) <= 20) ?? candidates[0];
  return clip(best, 120);
}

export function buildResearchInboxRemixFallback(
  item: Pick<ResearchInboxRecord, "text" | "title" | "itemType">,
  selectedNiche?: string | null
) {
  const base =
    item.itemType === "profile"
      ? cleanFallbackSourceText(item.title) || "creator positioning"
      : cleanFallbackSourceText(item.text) || cleanFallbackSourceText(item.title) || "saved X capture";
  const niche = selectedNiche ? `${selectedNiche} ` : "";

  return clip(
    `Most ${niche}creators miss this: ${base}. The win is not copying the tactic. It is stealing the structure, adding one proof point, and making the takeaway impossible to ignore.`,
    280
  );
}

export function mapResearchInboxItem(item: ResearchInboxRecord) {
  return {
    id: item.id,
    source: item.source,
    itemType: coerceType(item.itemType),
    sourceUrl: item.sourceUrl,
    xEntityId: item.xEntityId,
    title: item.title,
    text: item.text,
    authorUsername: item.authorUsername,
    authorDisplayName: item.authorDisplayName,
    authorAvatarUrl: item.authorAvatarUrl,
    status: coerceStatus(item.status),
    labels: item.labels,
    note: item.note,
    generatedReply: item.generatedReply,
    generatedRemix: item.generatedRemix,
    metadata: item.metadata,
    trackedAccountId: item.trackedAccountId,
    draftSeed: buildResearchInboxDraftSeed(item),
    lastActionAt: item.lastActionAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
