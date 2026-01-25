import { HighlightSuggestion } from "@clippers/types";

type HighlightPayload = {
  transcript: string;
  durationSec: number;
  target?: number;
  audience?: string;
  tone?: string;
  model?: string;
  callToAction?: string;
  brief?: string;
};

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_NANO_BANANA_API_KEY?.trim() ?? "";
export const HAS_GEMINI_KEY = Boolean(GEMINI_API_KEY);
const DEFAULT_GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL?.trim() ?? "gemini-2.5-pro";

const VIRAL_CLIP_EXAMPLES = [
  {
    title: "The $0 budget growth trap",
    hook: "Stop grinding on features nobody asked for—this $12 landing page tactic is what actually converts.",
    viralMechanic: "Pattern interrupt + contrarian take + curiosity gap with specific number",
    midpoint: "Show the before/after revenue graph, call out the emotional rollercoaster, and why scrappy beats polished.",
    payoff: "Close on the exact CTA lines that invite the viewer to steal the template while urgency is high."
  },
  {
    title: "AI assistant skepticism flip",
    hook: "You're probably ignoring the boring AI emails—here's the one workflow that made our editor 4x faster.",
    viralMechanic: "Call out common behavior + transformation promise with specific metric",
    midpoint: "Reveal the unexpected bottleneck, share the aha moment, and include the specific prompt wording.",
    payoff: "End with a hard CTA to reuse the prompt today plus a cliffhanger about the next unlock."
  },
  {
    title: "Creator pricing shock",
    hook: "Creators undercharge because they sell time, not outcomes. Watch this onboarding tweak double LTV overnight.",
    viralMechanic: "Universal pain point + mindset shift + dramatic result",
    midpoint: "Break down the objection, describe the narrative tension, and keep the beat tight with data checkpoints.",
    payoff: "Finish with a confident CTA pushing viewers to claim the pricing script while scarcity feels real."
  },
  {
    title: "Fitness transformation mistake",
    hook: "You're doing cardio wrong. This 90-second routine burns more fat than an hour on the treadmill.",
    viralMechanic: "Challenge conventional wisdom + shocking comparison + time efficiency",
    midpoint: "Demonstrate the technique, explain the science, show before/after results from real people.",
    payoff: "Action step to try today, promise of full program in bio, urgency around limited spots."
  },
  {
    title: "Parenting hack revelation",
    hook: "I stopped arguing with my 4-year-old and started doing this instead. Tantrums dropped by 80%.",
    viralMechanic: "Personal story + relatable struggle + dramatic improvement with metric",
    midpoint: "Reveal the counterintuitive technique, share the psychology behind it, give specific examples.",
    payoff: "Simple action parents can take tonight, invite to share their results in comments."
  },
  {
    title: "Investing mistake exposed",
    hook: "Financial advisors hate this. I turned $1,000 into $50k in 2 years without touching stocks.",
    viralMechanic: "Authority figure opposition + impressive transformation + curiosity about method",
    midpoint: "Break down the strategy step-by-step, show the compound effect, address common objections.",
    payoff: "Free resource link in bio, challenge viewers to start with just $100, create urgency."
  },
  {
    title: "Cooking secret revealed",
    hook: "Michelin chefs don't want you to know this. One ingredient transforms any dish instantly.",
    viralMechanic: "Insider secret + universal application + instant gratification promise",
    midpoint: "Reveal the ingredient, show 3 quick examples, explain the science of why it works.",
    payoff: "Challenge viewers to try it tonight and tag you, tease next week's secret ingredient."
  },
  {
    title: "Productivity mindset shift",
    hook: "I quit my 9-5 routine and now I work 4 hours a day making twice the income. Here's the mindset shift.",
    viralMechanic: "Lifestyle transformation + better results with less effort + provocative claim",
    midpoint: "Explain the old trap vs new approach, share the mental models, give real examples from their day.",
    payoff: "One action to take tomorrow morning, free guide in bio, invite to DM success stories."
  },
  {
    title: "Relationship communication breakthrough",
    hook: "My marriage was ending. Then my therapist taught me this 30-second technique. Everything changed.",
    viralMechanic: "High stakes + emotional vulnerability + simple solution + transformation",
    midpoint: "Teach the exact technique, share how it feels in practice, show the immediate impact.",
    payoff: "Challenge couples to try tonight, promise of deeper content in comments, create emotional connection."
  },
  {
    title: "Pet training revelation",
    hook: "Your dog isn't stubborn. You're using the wrong rewards. Watch what happens when I switch to this.",
    viralMechanic: "Reframe the problem + visual demonstration + instant gratification",
    midpoint: "Show the dramatic before/after, explain the psychology, give 3 examples of better rewards.",
    payoff: "Simple homework for tonight, invite to share their dog's progress, tease advanced techniques."
  }
] as const;

function buildSystemPrompt() {
  return [
    "You are an elite social video editor and viral content strategist with deep expertise in TikTok, Instagram Reels, and YouTube Shorts algorithms.",
    "Your mission: identify clips with MAXIMUM viral potential based on proven patterns that consistently generate millions of views.",
    "",
    "**VIRAL MECHANICS TO PRIORITIZE:**",
    "1. PATTERN INTERRUPT: Moments that challenge assumptions or start with 'You're doing X wrong' or 'Stop doing X'",
    "2. CURIOSITY GAP: Tease specific results without revealing how (e.g., '$1000 to $50k' or 'This doubled my...')",
    "3. TRANSFORMATION STORIES: Clear before/after with emotional stakes and specific metrics (% improvement, time saved, money made)",
    "4. CONTRARIAN TAKES: Goes against conventional wisdom or what 'experts say you should do'",
    "5. PERSONAL VULNERABILITY: High-stakes personal stories with emotional hooks ('My marriage was ending...', 'I was broke until...')",
    "6. INSTANT GRATIFICATION: Promises quick results ('30-second technique', '90-second routine', 'One ingredient')",
    "7. AUTHORITY CHALLENGE: 'Doctors hate this', 'Financial advisors don't want you to know'",
    "8. RELATABILITY + SOLUTION: Calls out universal struggles then provides unexpected solution",
    "",
    "**FIRST 3 SECONDS MUST HAVE:**",
    "- Bold statement, provocative question, or shocking claim",
    "- Specific numbers or metrics when possible",
    "- Pattern interrupt that stops the scroll",
    "- NO slow intros, greetings, or context-setting",
    "",
    "**MIDDLE SECTION MUST INCLUDE:**",
    "- Rising tension or escalating insight",
    "- Specific, actionable information (not vague advice)",
    "- Emotional peaks: surprise, excitement, inspiration, or controversy",
    "- Fast pacing with no dead air",
    "",
    "**ENDING MUST DELIVER:**",
    "- Clear payoff or resolution to the hook's promise",
    "- Strong call-to-action (try this tonight, DM me, link in bio)",
    "- Urgency or scarcity when appropriate",
    "- Cliffhanger for next video (optional but powerful)",
    "",
    "**OUTPUT FORMAT:**",
    "Return ONLY valid JSON: {\"highlights\":[{...}]} with no prose.",
    "Each highlight needs: title, hook, start_percent, end_percent, optional call_to_action.",
    "start_percent and end_percent are numeric (0-100), must be chronological, start < end.",
    "Target 30-45 seconds per clip. Return 3-10 high-confidence viral moments.",
    "Begin/end at sentence boundaries. No overlapping clips.",
    "",
    "**SELECTION CRITERIA:**",
    "Only select moments that genuinely have viral potential. Ask yourself:",
    "- Would this stop someone mid-scroll in the first 3 seconds?",
    "- Does it deliver a specific, valuable insight or transformation?",
    "- Is there emotional resonance or controversy?",
    "- Would viewers share this or tag a friend?",
    "",
    "If transcript lacks strong viral moments, still return your best options but prioritize specificity, contrarian angles, and emotional stakes over generic content."
  ].join(" ");
}

export async function generateGeminiHighlights(payload: HighlightPayload): Promise<HighlightSuggestion[] | null> {
  if (!HAS_GEMINI_KEY) {
    return null;
  }

  const model = payload.model?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const targetClips = Math.max(3, Math.min(10, payload.target ?? 5));

  // Use smarter transcript truncation for longer videos
  const maxTranscriptLength = 50000; // Increased from 16000 to 50000
  const truncatedTranscript = payload.transcript.length > maxTranscriptLength
    ? smartTruncateTranscript(payload.transcript, maxTranscriptLength)
    : payload.transcript;

  const requestBody = {
    systemInstruction: {
      role: "system",
      parts: [{ text: buildSystemPrompt() }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify({
              transcript: truncatedTranscript,
              duration_seconds: payload.durationSec,
              target_clips: targetClips,
              min_duration_seconds: 30,
              max_duration_seconds: 45,
              must_return_between: [3, targetClips],
              audience: payload.audience ?? "Ambitious creators",
              tone: payload.tone ?? "Tension, insight, payoff",
              call_to_action: payload.callToAction ?? "Drive viewers to subscribe or click through",
              campaign_brief:
                payload.brief?.slice(0, 600) ??
                "Prioritise contrarian, high-energy moments with specific takeaways and emotional stakes.",
              examples: VIRAL_CLIP_EXAMPLES
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      topK: 40,
      candidateCount: 1,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini highlight request failed (${response.status}): ${errorText.slice(0, 400)}`);
  }

  const payloadJson = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text =
    payloadJson.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    return null;
  }

  let jsonText = text;
  if (!jsonText.trim().startsWith("{")) {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      jsonText = match[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as { highlights?: Array<any> };
    if (!parsed.highlights || !Array.isArray(parsed.highlights)) {
      return null;
    }

    const suggestions = parsed.highlights
      .map((item) => ({
        title: String(item.title ?? item.headline ?? "Highlight").trim(),
        hook: String(item.hook ?? item.opening ?? item.title ?? "").trim(),
        startPercent: Number.parseFloat(item.start_percent ?? item.startPercent ?? item.start ?? 0),
        endPercent: Number.parseFloat(item.end_percent ?? item.endPercent ?? item.end ?? 0),
        callToAction: item.call_to_action ?? item.cta ?? item.outro ?? undefined
      }))
      .filter(
        (item) =>
          Number.isFinite(item.startPercent) &&
          Number.isFinite(item.endPercent) &&
          item.endPercent > item.startPercent
      );

    return suggestions.length > 0 ? suggestions : null;
  } catch (error) {
    console.error("Failed to parse Gemini highlight response", error, jsonText);
    return null;
  }
}

/**
 * Smart transcript truncation that preserves complete sentences
 * and prioritizes content diversity across the video
 */
function smartTruncateTranscript(transcript: string, maxLength: number): string {
  if (transcript.length <= maxLength) {
    return transcript;
  }

  // Strategy: Sample from beginning, middle, and end to get diverse content
  const segmentSize = Math.floor(maxLength / 3);
  const totalLength = transcript.length;

  // Extract beginning (first segment)
  const beginning = transcript.slice(0, segmentSize);
  const beginningEnd = beginning.lastIndexOf('. ') > 0
    ? beginning.lastIndexOf('. ') + 1
    : beginning.lastIndexOf(' ');
  const beginningSegment = transcript.slice(0, beginningEnd > 0 ? beginningEnd : segmentSize);

  // Extract middle (around 50% mark)
  const middleStart = Math.floor(totalLength * 0.4);
  const middleChunk = transcript.slice(middleStart, middleStart + segmentSize);
  const middleChunkStart = middleChunk.indexOf('. ') > 0
    ? middleChunk.indexOf('. ') + 1
    : middleChunk.indexOf(' ');
  const middleChunkEnd = middleChunk.lastIndexOf('. ') > 0
    ? middleChunk.lastIndexOf('. ') + 1
    : middleChunk.lastIndexOf(' ');
  const middleSegment = middleChunk.slice(
    middleChunkStart > 0 ? middleChunkStart : 0,
    middleChunkEnd > 0 ? middleChunkEnd : segmentSize
  );

  // Extract end (last segment)
  const endStart = totalLength - segmentSize;
  const endChunk = transcript.slice(endStart);
  const endChunkStart = endChunk.indexOf('. ') > 0
    ? endChunk.indexOf('. ') + 1
    : endChunk.indexOf(' ');
  const endSegment = endChunk.slice(endChunkStart > 0 ? endChunkStart : 0);

  // Combine with markers
  return [
    beginningSegment.trim(),
    '\n[... middle section ...]\n',
    middleSegment.trim(),
    '\n[... later section ...]\n',
    endSegment.trim()
  ].join(' ');
}
