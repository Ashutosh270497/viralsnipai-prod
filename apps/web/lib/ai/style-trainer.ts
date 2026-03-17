import { getActiveClient } from "@/lib/openrouter-client";

const STYLE_ANALYSIS_TARGET = getActiveClient(null, "snipradarStyleAnalysis");
const STYLE_REWRITE_TARGET = getActiveClient(null, "snipradarStyleRewrite");

export interface StyleProfile {
  tone: string;
  vocabulary: string[];
  avgLength: number;
  emojiUsage: "heavy" | "light" | "none";
  hashtagStyle: "none" | "1-2 relevant" | "heavy";
  sentencePattern: "short punchy" | "long flowing" | "mixed";
}

const TRAIN_PROMPT = `You are an expert writing style analyst specializing in social media copy.

Analyze these tweets/posts and extract a detailed writing style profile. Focus on recurring patterns, not one-off anomalies.

Return a JSON object with:
- tone: A short description of the writing tone (e.g. "casual, witty, slightly provocative")
- vocabulary: Array of 10-20 distinctive words/phrases this person frequently uses
- avgLength: Average character count per post (number)
- emojiUsage: "heavy" (3+ per post), "light" (occasional), or "none"
- hashtagStyle: "none", "1-2 relevant", or "heavy" (3+)
- sentencePattern: "short punchy" (under 15 words avg), "long flowing" (25+ words), or "mixed"

Be specific and observational. The goal is to replicate this person's voice in future generations.`;

const APPLY_PROMPT = `You are an expert ghostwriter. Rewrite the given text to match this person's exact writing style.

Style profile:
- Tone: {tone}
- Typical vocabulary: {vocabulary}
- Average length: {avgLength} characters
- Emoji usage: {emojiUsage}
- Hashtag style: {hashtagStyle}
- Sentence pattern: {sentencePattern}

Rules:
- Keep the core message and meaning intact
- Match the tone, vocabulary, and patterns exactly
- Output MUST be ≤280 characters
- Return ONLY the rewritten text, nothing else`;

export async function trainStyle(posts: string[]): Promise<StyleProfile | null> {
  if (!STYLE_ANALYSIS_TARGET.client || !STYLE_ANALYSIS_TARGET.model) return null;
  if (posts.length < 10) return null;

  try {
    const response = await STYLE_ANALYSIS_TARGET.client.chat.completions.create({
      model: STYLE_ANALYSIS_TARGET.model,
      messages: [
        { role: "system", content: TRAIN_PROMPT },
        { role: "user", content: `Analyze these ${posts.length} posts:\n\n${posts.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as StyleProfile;
    return parsed;
  } catch {
    return null;
  }
}

export async function applyStyle(
  text: string,
  profile: StyleProfile
): Promise<string | null> {
  if (!STYLE_REWRITE_TARGET.client || !STYLE_REWRITE_TARGET.model) return null;

  const systemPrompt = APPLY_PROMPT
    .replace("{tone}", profile.tone)
    .replace("{vocabulary}", profile.vocabulary.join(", "))
    .replace("{avgLength}", String(profile.avgLength))
    .replace("{emojiUsage}", profile.emojiUsage)
    .replace("{hashtagStyle}", profile.hashtagStyle)
    .replace("{sentencePattern}", profile.sentencePattern);

  try {
    const response = await STYLE_REWRITE_TARGET.client.chat.completions.create({
      model: STYLE_REWRITE_TARGET.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;
    return content.slice(0, 280);
  } catch {
    return null;
  }
}
