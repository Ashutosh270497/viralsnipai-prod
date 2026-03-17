/**
 * AI Prompt Generator Service
 *
 * Generates optimized brief, audience, tone, and CTA prompts
 * by analyzing the actual video transcript content.
 */

import OpenAI from 'openai';
import { logger } from '../logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
      logger.info('Generating prompts from transcript', {
        transcriptLength: input.transcript.length,
        videoTitle: input.videoTitle,
        platform: input.platform,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.getTranscriptSystemPrompt() },
          { role: 'user', content: this.buildTranscriptUserPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const generated = JSON.parse(content) as GeneratedPrompts;

      logger.info('Transcript-based prompts generated', {
        briefLength: generated.brief.length,
      });

      return generated;
    } catch (error) {
      logger.error('Failed to generate transcript-based prompts', error as Error);
      return this.getFallbackPrompts(input.platform);
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

  private getFallbackPrompts(platform?: string): GeneratedPrompts {
    const p = platform || 'YouTube Shorts';

    return {
      brief: 'Find clips with the strongest emotional peaks, surprising revelations, actionable advice, and contrarian takes. Prioritize moments with specific numbers, transformation stories, and "aha" insights that deliver immediate value.',
      audience: `${p} viewers aged 18-45 seeking actionable insights and shareable moments`,
      tone: 'High-energy with pattern interrupts. Bold claims with proof. No slow intros — straight to value',
      callToAction: p === 'TikTok'
        ? 'Like for part 2, follow for more, comment your results, stitch this'
        : p === 'Instagram Reels'
        ? 'Save this, share to story, DM me for full guide, tag someone who needs this'
        : 'Like for part 2, subscribe for more, comment your takeaway, full video in description',
      reasoning: 'Fallback prompts — transcript analysis was unavailable. These focus on universal viral mechanics.',
    };
  }
}

/**
 * Singleton instance
 */
export const promptGeneratorService = new PromptGeneratorService();
