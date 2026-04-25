/**
 * AI Prompt Generator Service
 *
 * Generates optimized brief, audience, tone, and CTA prompts
 * by analyzing the actual video transcript content.
 */

import { logger } from '../logger';
import { routedChatCompletion } from '@/lib/openrouter-client';

const MAX_TRANSCRIPT_CHARS_FOR_PROMPTS = 15000;

export interface TranscriptPromptInput {
  transcript: string;
  videoTitle?: string;
  platform?: string;
  customInstructions?: string;
}

export interface GeneratedPrompts {
  brief: string;
  audience: string;
  tone: string;
  callToAction: string;
  reasoning: string;
}

export class PromptGeneratorService {
  /**
   * Generate prompts by analyzing the actual video transcript.
   */
  async generateFromTranscript(input: TranscriptPromptInput): Promise<GeneratedPrompts> {
    try {
      const transcript = normalizeTranscript(input.transcript);
      logger.info('Generating prompts from transcript', {
        transcriptLength: transcript.length,
        videoTitle: input.videoTitle,
        platform: input.platform,
      });

      const content = await routedChatCompletion(
        null,
        'videoIngest',
        '',
        [
          { role: 'system', content: this.getTranscriptSystemPrompt() },
          { role: 'user', content: this.buildTranscriptUserPrompt({ ...input, transcript }) },
        ],
        { maxTokens: 2048, temperature: 0.35, json: true, disableReasoning: true }
      );

      if (!content.trim()) {
        throw new Error('OpenRouter returned an empty prompt response.');
      }

      const rawJson = extractJsonObject(content);
      const generated = parseGeneratedPrompts(rawJson);
      validateGeneratedPrompts(generated);

      logger.info('Transcript-based prompts generated', {
        briefLength: generated.brief.length,
      });

      return generated;
    } catch (error) {
      logger.error('Failed to generate transcript-based prompts', error as Error);
      throw error;
    }
  }

  private getTranscriptSystemPrompt(): string {
    return `You are an expert viral content strategist. You will receive the FULL TRANSCRIPT of a video. Your job is to analyze the actual content — topics discussed, key moments, speaker style, unique insights — and generate highly targeted prompts that will help an AI detect the most viral clips from THIS specific video.

**Your output must be grounded in the transcript.** Reference specific topics, phrases, stories, or data points from the transcript. Do NOT generate generic prompts.

**OUTPUT FORMAT (JSON):**

1. **brief** (200-500 chars): What specific moments to look for in THIS video. Reference actual topics, stories, numbers, or turning points from the transcript. Use action verbs: "Extract the segment where...", "Find the moment when...", "Prioritize the section about..."

2. **audience** (80-150 chars): Who would find THIS specific content most valuable, based on what's actually discussed.

3. **tone** (40-120 chars): Describe the speaker's actual energy and style from the transcript, and how clips should feel.

4. **callToAction** (30-100 chars): Platform-appropriate CTAs that connect to the actual content topics.

5. **reasoning** (2-3 sentences): Explain which specific parts of the transcript have the highest viral potential and why.

Return ONLY a JSON object:
{
  "brief": "...",
  "audience": "...",
  "tone": "...",
  "callToAction": "...",
  "reasoning": "..."
}`;
  }

  private buildTranscriptUserPrompt(input: TranscriptPromptInput): string {
    const parts: string[] = [];

    if (input.videoTitle) {
      parts.push(`**VIDEO TITLE:** ${input.videoTitle}\n`);
    }

    parts.push(`**TARGET PLATFORM:** ${input.platform || 'YouTube Shorts'}`);
    parts.push(`**TARGET CLIP LENGTH:** 30-60 seconds\n`);

    if (input.customInstructions) {
      parts.push(`**CUSTOM INSTRUCTIONS:** ${input.customInstructions}\n`);
    }

    parts.push(`**FULL TRANSCRIPT:**`);
    parts.push(input.transcript);

    parts.push(`\n**TASK:** Analyze this transcript and generate prompts that reference the SPECIFIC content, topics, stories, and insights discussed. The prompts should help an AI find the most viral 30-60 second clips from this particular video.`);

    return parts.join('\n');
  }

}

/**
 * Singleton instance
 */
export const promptGeneratorService = new PromptGeneratorService();

function extractJsonObject(content: string): string {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (stripped.startsWith('{') && stripped.endsWith('}')) {
    return stripped;
  }

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }

  return stripped;
}

function normalizeTranscript(transcript: string): string {
  const normalized = transcript.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Transcript is empty.');
  }

  if (normalized.length <= MAX_TRANSCRIPT_CHARS_FOR_PROMPTS) {
    return normalized;
  }

  const head = normalized.slice(0, 9000);
  const tail = normalized.slice(-5500);
  return `${head}\n\n[Transcript truncated for prompt generation]\n\n${tail}`;
}

function parseGeneratedPrompts(rawJson: string): GeneratedPrompts {
  try {
    return JSON.parse(rawJson) as GeneratedPrompts;
  } catch {
    throw new Error('OpenRouter returned malformed prompt JSON.');
  }
}

function validateGeneratedPrompts(value: GeneratedPrompts): void {
  const requiredFields: Array<keyof GeneratedPrompts> = [
    'brief',
    'audience',
    'tone',
    'callToAction',
    'reasoning',
  ];

  const missing = requiredFields.filter((field) => typeof value?.[field] !== 'string' || !value[field].trim());
  if (missing.length > 0) {
    throw new Error(`OpenRouter prompt response is missing required fields: ${missing.join(', ')}`);
  }
}
