export const HIGHLIGHT_MODEL_VALUES = [
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite-preview",
  "openai/gpt-5.3-chat",
  "openai/gpt-5.3-codex",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Best for long video)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Fast multimodal)" },
  { value: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Fastest)" },
  { value: "openai/gpt-5.3-chat", label: "GPT-5.3 Chat (Premium reasoning)" },
  { value: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex (Deep QA)" },
];
