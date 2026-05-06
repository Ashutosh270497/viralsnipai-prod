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
  { value: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
  { value: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5" },
  { value: "openai/gpt-4o", label: "openai/gpt-4o" },
  { value: "qwen/qwen3.6-plus", label: "qwen/qwen3.6-plus" },
  { value: "google/gemini-3-flash-preview", label: "google/gemini-3-flash-preview" },
];
