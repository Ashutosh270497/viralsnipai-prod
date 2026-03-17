import type { StyleProfile } from "@/lib/ai/style-trainer";

export function toStyleProfile(record: {
  tone: string | null;
  vocabulary: unknown;
  avgLength: number | null;
  emojiUsage: unknown;
  hashtagStyle: unknown;
  sentencePattern: unknown;
} | null): StyleProfile | null {
  if (!record?.tone) return null;

  return {
    tone: record.tone,
    vocabulary: Array.isArray(record.vocabulary)
      ? record.vocabulary.filter((item): item is string => typeof item === "string")
      : [],
    avgLength: record.avgLength ?? 200,
    emojiUsage: (record.emojiUsage as StyleProfile["emojiUsage"]) ?? "light",
    hashtagStyle: (record.hashtagStyle as StyleProfile["hashtagStyle"]) ?? "none",
    sentencePattern: (record.sentencePattern as StyleProfile["sentencePattern"]) ?? "mixed",
  };
}
