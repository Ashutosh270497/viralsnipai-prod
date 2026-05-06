export const HIGHLIGHT_MODEL_VALUES = [
  "google/gemini-2.5-pro",
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.2",
  "google/gemini-3.1-pro-preview",
  "qwen/qwen3.6-plus",
  "google/gemini-3-flash-preview",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — Balanced" },
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 — Best Quality" },
  { value: "openai/gpt-5.2", label: "GPT-5.2 — Fallback" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview — Fallback" },
  { value: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus — Fallback" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash — Fast" },
];
