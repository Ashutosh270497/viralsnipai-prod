/**
 * AI Prompt Generator Service
 *
 * Generates optimized brief, audience, tone, and CTA prompts
 * for viral moment detection based on user context.
 */

import OpenAI from 'openai';
import { logger } from '../logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface PromptGenerationInput {
  context: string;           // User's description of their video/content
  contentType?: string;      // e.g., "business", "fitness", "education"
  platform?: string;         // e.g., "YouTube Shorts", "TikTok", "Instagram Reels"
  targetLength?: number;     // Target clip length in seconds
  customInstructions?: string; // Any additional requirements
}

export interface GeneratedPrompts {
  brief: string;
  audience: string;
  tone: string;
  callToAction: string;
  reasoning: string; // Why these prompts were generated
}

export class PromptGeneratorService {
  /**
   * Generate optimized prompts based on user context
   */
  async generatePrompts(input: PromptGenerationInput): Promise<GeneratedPrompts> {
    try {
      logger.info('Generating AI prompts', {
        contextLength: input.context.length,
        contentType: input.contentType,
        platform: input.platform
      });

      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.buildUserPrompt(input);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8 // Higher creativity for diverse prompts
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const generated = JSON.parse(content) as GeneratedPrompts;

      logger.info('AI prompts generated successfully', {
        briefLength: generated.brief.length,
        audienceLength: generated.audience.length
      });

      return generated;

    } catch (error) {
      logger.error('Failed to generate AI prompts', error);
      return this.getFallbackPrompts(input);
    }
  }

  /**
   * System prompt for AI prompt generation
   */
  private getSystemPrompt(): string {
    return `You are an expert prompt engineer and viral content strategist specializing in short-form video optimization for TikTok, Instagram Reels, and YouTube Shorts.

Your task is to generate highly optimized prompts (brief, audience, tone, CTA) that will help an AI detect the most viral moments in a video.

**PROMPT GENERATION PRINCIPLES:**

1. **BRIEF (150-500 characters):**
   - Specify exact viral mechanics to look for (pattern interrupts, curiosity gaps, transformations)
   - Include specific metrics or numbers to prioritize ("$X to $Y", "% improvement", "X-second technique")
   - Mention contrarian angles or authority challenges when relevant
   - Use action verbs: "Extract", "Find", "Prioritize", "Look for"
   - Be specific about content structure (before/after, setup/payoff, problem/solution)

2. **AUDIENCE (50-150 characters):**
   - Be hyper-specific about demographics (age, role, struggles)
   - Include psychographics (goals, pain points, consumption habits)
   - Mention attention span and engagement patterns
   - Describe what makes them share/save content
   - Example: "Busy entrepreneurs 25-40 seeking unconventional growth hacks with proven ROI who scroll aggressively and demand instant value"

3. **TONE (30-120 characters):**
   - Specify energy level (urgent, calm, enthusiastic, contrarian)
   - Mention pacing requirements (fast-paced, no dead air, rapid-fire)
   - Include emotional qualities (vulnerability, confidence, rebellious)
   - Specify content approach (no fluff, straight to point, bold claims with proof)
   - Example: "Urgent contrarian energy with pattern interrupts. Bold claims with metrics. No intros—scroll-stopping hooks"

4. **CALL TO ACTION (20-100 characters):**
   - Platform-appropriate CTAs (DM, comment, save, share, link in bio)
   - Create urgency or scarcity when relevant
   - Encourage engagement and community building
   - Multiple CTAs separated by commas
   - Example: "Like for part 2, follow for daily hacks, DM me 'guide', save to try later, tag someone who needs this"

**PLATFORM-SPECIFIC OPTIMIZATION:**

- **YouTube Shorts:** Longer CTAs okay, focus on "subscribe" and "full video in description"
- **TikTok:** Strong emphasis on "stitch this", "duet", "part 2", trending sounds
- **Instagram Reels:** Focus on "save", "share to story", "link in bio", DM engagement

**CONTENT TYPE PATTERNS:**

- **Business/Entrepreneurship:** Focus on ROI, growth metrics, contrarian strategies, time/money saved
- **Fitness/Health:** Emphasize transformations, time efficiency, myth-busting, science-backed claims
- **Education:** Prioritize "aha moments", debunked myths, simplified complex topics, counterintuitive facts
- **Entertainment:** Relatable moments, perfect timing, tag-a-friend energy, shareable humor
- **Personal Development:** Emotional vulnerability, specific techniques, relatable struggles, mindset shifts

**REASONING:**
Explain in 2-3 sentences why these specific prompts will maximize viral moment detection for this content.

Return ONLY a JSON object with this structure:
{
  "brief": "<optimized brief 150-500 chars>",
  "audience": "<hyper-specific audience 50-150 chars>",
  "tone": "<precise tone guidance 30-120 chars>",
  "callToAction": "<platform-appropriate CTAs 20-100 chars>",
  "reasoning": "<2-3 sentence explanation>"
}`;
  }

  /**
   * Build user prompt from input
   */
  private buildUserPrompt(input: PromptGenerationInput): string {
    const parts: string[] = [
      `**VIDEO CONTEXT:**`,
      input.context
    ];

    if (input.contentType) {
      parts.push(`\n**CONTENT TYPE:** ${input.contentType}`);
    }

    if (input.platform) {
      parts.push(`**TARGET PLATFORM:** ${input.platform}`);
    } else {
      parts.push(`**TARGET PLATFORM:** YouTube Shorts (default)`);
    }

    if (input.targetLength) {
      parts.push(`**TARGET CLIP LENGTH:** ${input.targetLength} seconds`);
    } else {
      parts.push(`**TARGET CLIP LENGTH:** 30-45 seconds`);
    }

    if (input.customInstructions) {
      parts.push(`\n**CUSTOM REQUIREMENTS:**`, input.customInstructions);
    }

    parts.push(
      `\n**TASK:**`,
      `Generate optimized prompts (brief, audience, tone, callToAction) that will help detect the most viral moments in this video.`,
      `Ensure the prompts leverage specific viral mechanics relevant to this content type and platform.`
    );

    return parts.join('\n');
  }

  /**
   * Fallback prompts when AI generation fails
   */
  private getFallbackPrompts(input: PromptGenerationInput): GeneratedPrompts {
    const platform = input.platform || 'YouTube Shorts';

    return {
      brief: `Find clips with pattern interrupts, curiosity gaps, and transformation stories. Prioritize moments with specific metrics, contrarian takes, and emotional peaks. Look for "you're doing X wrong" moments and "this changes everything" revelations that deliver immediate actionable value.`,

      audience: `${platform} viewers aged 18-45 with short attention spans who demand instant value, scroll aggressively, and share content that delivers quick wins or emotional resonance`,

      tone: `Urgent, contrarian, high-energy with pattern interrupts. Bold claims with proof. No slow intros—straight to scroll-stopping moments`,

      callToAction: platform === 'TikTok'
        ? 'Like for part 2, follow for daily tips, comment your results, stitch this'
        : platform === 'Instagram Reels'
        ? 'Save this, share to story, DM me for full guide, tag someone who needs this'
        : 'Like for part 2, subscribe for daily tips, comment your takeaway, link in description',

      reasoning: 'These general prompts focus on core viral mechanics while being platform-appropriate. They prioritize pattern interrupts and instant value delivery which work across most content types.'
    };
  }

  /**
   * Generate quick templates based on content type
   */
  getTemplatePrompts(contentType: string, platform: string = 'YouTube Shorts'): GeneratedPrompts {
    const templates: Record<string, GeneratedPrompts> = {
      business: {
        brief: 'Extract clips with money transformations, growth hacks with specific numbers, productivity breakthroughs, and "financial advisors don\'t want you to know" moments. Prioritize scrappy wins over polished advice. Look for "$X to $Y" transformations, time-saving techniques, and counterintuitive business strategies.',
        audience: 'Ambitious entrepreneurs, side hustlers, and creators aged 25-40 seeking unconventional growth strategies and shortcuts to success with proven results',
        tone: 'Energetic rebel challenging status quo. Contrarian insights with receipts. Pattern interrupts with urgency and specificity. No fluff',
        callToAction: 'DM me "blueprint" for full framework, follow for daily business hacks, save and try this week',
        reasoning: 'Business audience responds to specific ROI metrics, contrarian strategies, and time/money savings with proof.'
      },

      fitness: {
        brief: 'Find transformation moments with specific metrics (pounds lost, time saved, % improvement). Prioritize clips that challenge conventional fitness wisdom. Look for 30-60 second techniques, science-backed shortcuts, and before/after revelations with dramatic results.',
        audience: 'Busy individuals aged 20-50 seeking efficient workouts, quick results, science-backed fitness hacks without spending hours in gym',
        tone: 'Confident, science-backed challenge to fitness myths. Fast-paced demonstrations with visible transformations. No BS',
        callToAction: 'Try this tonight and report back, follow for 30-second fitness hacks, save this routine',
        reasoning: 'Fitness content thrives on visual transformations, time efficiency, and myth-busting with scientific backing.'
      },

      education: {
        brief: 'Find "mind-blown" moments where complex topics get simplified into aha insights. Prioritize "wait, that\'s why" revelations, debunked myths with proof, and "experts are wrong about" moments. Look for curiosity gaps with satisfying payoffs.',
        audience: 'Curious learners aged 18-40 who love "today I learned" moments and appreciate simplified explanations that challenge common beliefs',
        tone: 'Enthusiastic curiosity with "mind-blown" energy. Build intrigue then deliver satisfying answers. Fast-paced intellectual excitement',
        callToAction: 'Follow for daily mind-blowing facts, comment what else you want explained, save to share later',
        reasoning: 'Educational content needs clear aha moments, myth-busting, and curiosity gaps that deliver intellectual satisfaction.'
      },

      entertainment: {
        brief: 'Extract peak comedic moments with perfect timing, relatable observations, unexpected punchlines, and "wait for it" payoffs. Prioritize highly shareable moments people will tag friends in.',
        audience: 'Entertainment seekers aged 16-35 who scroll for laughs, tag friends in relatable content, and share videos that capture shared experiences',
        tone: 'Relatable humor with perfect timing. "This is so accurate" energy. Shareable moments that make viewers tag friends',
        callToAction: 'Tag someone who needs to see this, follow for daily laughs, share if you felt this',
        reasoning: 'Comedy thrives on relatability, perfect timing, and tag-a-friend moments that drive organic sharing.'
      },

      personal_development: {
        brief: 'Extract high-stakes personal stories with emotional vulnerability. Look for "my life was falling apart until" moments, 30-second techniques, therapist secrets, and mindset shifts with specific outcomes. Prioritize emotional peaks and relatable struggles.',
        audience: 'Self-improvement seekers aged 22-45 struggling with anxiety, relationships, career who crave authentic vulnerability and actionable techniques',
        tone: 'Raw authenticity with high stakes. Emotional vulnerability that creates connection. Real struggles with real solutions',
        callToAction: 'Try this technique tonight, DM me if you need this, save for when you need it, share with someone',
        reasoning: 'Personal development requires authentic vulnerability, specific actionable techniques, and emotional resonance with universal struggles.'
      }
    };

    const template = templates[contentType.toLowerCase()] || templates.education;

    // Adjust CTA for platform
    if (platform === 'TikTok') {
      template.callToAction = template.callToAction.replace(/DM me/g, 'Comment').replace(/save/g, 'bookmark');
    } else if (platform === 'Instagram Reels') {
      template.callToAction = template.callToAction.replace(/follow/g, 'follow and turn on notifications');
    }

    return template;
  }
}

/**
 * Singleton instance
 */
export const promptGeneratorService = new PromptGeneratorService();
