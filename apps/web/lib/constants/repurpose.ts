export const HIGHLIGHT_MODEL_VALUES = [
  "openai/gpt-5.2",
  "anthropic/claude-sonnet-4.6",
  "qwen/qwen3.6-plus",
  "google/gemini-3-flash-preview",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "openai/gpt-5.2", label: "GPT-5.2 — Balanced" },
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 — Best Quality" },
  { value: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus — Fallback" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash — Fast" },
];
