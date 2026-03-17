export const HIGHLIGHT_MODEL_VALUES = [
  "gemini-3-flash-preview",
  "gpt-5.2",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
] as const;

export type HighlightModel = (typeof HIGHLIGHT_MODEL_VALUES)[number];

export const HIGHLIGHT_MODEL_OPTIONS: Array<{
  value: HighlightModel;
  label: string;
}> = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Recommended)" },
  { value: "gpt-5.2", label: "GPT-5.2 (Premium Reasoning)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Deep Multimodal)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Stable)" },
];
