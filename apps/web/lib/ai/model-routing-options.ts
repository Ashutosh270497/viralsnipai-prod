export type QualityMode = "fast" | "balanced" | "best";

export type ClipIntent =
  | "auto"
  | "viral_hooks"
  | "educational"
  | "contrarian"
  | "story"
  | "product_demo"
  | "funny"
  | "quotes";

export const QUALITY_MODE_VALUES = ["fast", "balanced", "best"] as const;

export const CLIP_INTENT_VALUES = [
  "auto",
  "viral_hooks",
  "educational",
  "contrarian",
  "story",
  "product_demo",
  "funny",
  "quotes",
] as const;

export const QUALITY_MODE_OPTIONS: Array<{
  value: QualityMode;
  label: string;
  description: string;
}> = [
  {
    value: "fast",
    label: "Fast",
    description: "Quicker results for drafts and shorter videos.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Recommended. Strong quality with good speed.",
  },
  {
    value: "best",
    label: "Best Quality",
    description: "Highest reasoning quality for important videos.",
  },
];

export const CLIP_INTENT_OPTIONS: Array<{ value: ClipIntent; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "viral_hooks", label: "Viral Hooks" },
  { value: "educational", label: "Educational" },
  { value: "contrarian", label: "Contrarian Takes" },
  { value: "story", label: "Story Moments" },
  { value: "product_demo", label: "Product Demo" },
  { value: "funny", label: "Funny / Reactions" },
  { value: "quotes", label: "Strong Quotes" },
];
