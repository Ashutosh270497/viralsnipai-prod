export const HIGHLIGHT_MODEL_VALUES = [
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
  "qwen/qwen3.6-plus",
  "xiaomi/mimo-v2.5",
  "google/gemini-3.1-flash-lite-preview",
  "openai/gpt-5.5",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Best overall)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Balanced video)" },
  { value: "qwen/qwen3.6-plus", label: "Qwen3.6 Plus (Cost-efficient video)" },
  { value: "xiaomi/mimo-v2.5", label: "MiMo V2.5 (Native audio/video)" },
  { value: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Fastest)" },
  { value: "openai/gpt-5.5", label: "GPT-5.5 (Premium transcript QA)" },
];
