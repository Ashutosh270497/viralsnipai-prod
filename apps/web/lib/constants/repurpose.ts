export const HIGHLIGHT_MODEL_VALUES = [
  "google/gemini-2.5-pro",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-4o",
  "qwen/qwen3.6-plus",
  "google/gemini-3-flash-preview",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Best reranking)" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 (Creative judgment)" },
  { value: "openai/gpt-4o", label: "GPT-4o via OpenRouter (Balanced)" },
  { value: "qwen/qwen3.6-plus", label: "Qwen3.6 Plus (Cost-efficient)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Fast)" },
];
