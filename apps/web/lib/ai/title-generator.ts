import { TitleGeneratorInput, TitleVariation, POWER_WORDS } from "@/types/title";
import { routedChatCompletion, openRouterClient } from "@/lib/openrouter-client";

const client = openRouterClient;

/**
 * Smart truncate title at word boundary
 */
function smartTruncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }

  // Find the last space before maxLength
  let truncated = title.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    // If we have a space in the last 20% of the limit, truncate there
    truncated = truncated.slice(0, lastSpace);
  } else {
    // Otherwise, just use the full limit (better than breaking mid-word)
    // Remove any partial word at the end
    const words = truncated.split(' ');
    words.pop(); // Remove last potentially partial word
    truncated = words.join(' ');
  }

  return truncated.trim();
}

/**
 * Analyze title quality and calculate scores
 */
export function analyzeTitleQuality(
  title: string,
  keywords: string[],
  maxLength: number
): {
  ctrScore: number;
  keywordOptimizationScore: number;
  curiosityScore: number;
  clarityScore: number;
  powerWordCount: number;
  lengthOptimal: boolean;
  keywordOptimized: boolean;
} {
  const titleLower = title.toLowerCase();
  const titleLength = title.length;

  // Keyword optimization (0-100)
  let keywordOptimizationScore = 0;
  let keywordOptimized = false;

  if (keywords.length > 0) {
    const primaryKeyword = keywords[0].toLowerCase();
    const keywordPosition = titleLower.indexOf(primaryKeyword);

    if (keywordPosition !== -1) {
      keywordOptimized = true;
      // Bonus for keyword in first 60 chars (mobile truncation)
      if (keywordPosition < 60) {
        keywordOptimizationScore = 100;
      } else {
        keywordOptimizationScore = 70;
      }

      // Bonus for keyword in first 40 chars
      if (keywordPosition < 40) {
        keywordOptimizationScore = Math.min(100, keywordOptimizationScore + 10);
      }
    } else {
      // Check for partial matches or synonyms
      const words = primaryKeyword.split(' ');
      const matchedWords = words.filter(word => titleLower.includes(word));
      keywordOptimizationScore = Math.floor((matchedWords.length / words.length) * 50);
    }

    // Bonus for secondary keywords
    const secondaryMatches = keywords.slice(1).filter(kw => titleLower.includes(kw.toLowerCase()));
    keywordOptimizationScore += secondaryMatches.length * 5;
    keywordOptimizationScore = Math.min(100, keywordOptimizationScore);
  }

  // Count power words
  const allPowerWords = Object.values(POWER_WORDS).flat();
  const powerWordCount = allPowerWords.filter(word =>
    titleLower.includes(word.toLowerCase())
  ).length;

  // Curiosity score (0-100)
  let curiosityScore = 40; // Base score

  // Boost for curiosity power words
  const curiosityWords = POWER_WORDS.curiosity;
  const curiosityWordCount = curiosityWords.filter(word => titleLower.includes(word)).length;
  curiosityScore += curiosityWordCount * 15;

  // Boost for questions
  if (title.includes('?')) curiosityScore += 15;

  // Boost for numbers (specific is more curious)
  if (/\d+/.test(title)) curiosityScore += 10;

  // Boost for parentheses (teasing additional info)
  if (title.includes('(') && title.includes(')')) curiosityScore += 10;

  curiosityScore = Math.min(100, curiosityScore);

  // Clarity score (0-100)
  let clarityScore = 100;

  // Penalize if too long
  if (titleLength > maxLength) {
    clarityScore -= Math.min(30, (titleLength - maxLength) * 2);
  }

  // Penalize if too short (not descriptive enough)
  if (titleLength < 40) {
    clarityScore -= (40 - titleLength);
  }

  // Penalize excessive punctuation
  const punctuationCount = (title.match(/[!?.,;:]/g) || []).length;
  if (punctuationCount > 3) {
    clarityScore -= (punctuationCount - 3) * 5;
  }

  // Penalize ALL CAPS
  const capsRatio = (title.match(/[A-Z]/g) || []).length / titleLength;
  if (capsRatio > 0.3) {
    clarityScore -= 20;
  }

  clarityScore = Math.max(0, Math.min(100, clarityScore));

  // Length optimal
  const lengthOptimal = titleLength >= 50 && titleLength <= 70;

  // Overall CTR prediction (weighted average)
  const ctrScore = Math.round(
    keywordOptimizationScore * 0.3 +
    curiosityScore * 0.3 +
    clarityScore * 0.2 +
    (lengthOptimal ? 100 : 60) * 0.1 +
    Math.min(powerWordCount * 10, 50) * 0.1
  );

  return {
    ctrScore,
    keywordOptimizationScore,
    curiosityScore,
    clarityScore,
    powerWordCount,
    lengthOptimal,
    keywordOptimized,
  };
}

/**
 * Generate mock titles for development/fallback
 */
function generateMockTitles(input: TitleGeneratorInput): TitleVariation[] {
  const { videoTopic, keywords, targetAudience, titleStyle, maxLength } = input;
  const primaryKeyword = keywords[0] || "this";

  // Extract core subject from topic (remove question words, etc.)
  const coreSubject = videoTopic
    .replace(/^(what is|how to|why|when|where|who)\s+/i, '')
    .replace(/\?.*$/, '')
    .trim();

  const mockTitles = [
    `I Tried ${coreSubject} for 30 Days (Results)`,
    `${primaryKeyword}: 5 Things ${targetAudience} Must Know`,
    `The Secret to ${coreSubject} Nobody Shares`,
    `${coreSubject} Explained in 3 Minutes`,
    `Stop Making These ${primaryKeyword} Mistakes`,
  ];

  return mockTitles.map((title, index) => {
    const truncatedTitle = smartTruncateTitle(title, maxLength);
    const analysis = analyzeTitleQuality(truncatedTitle, keywords, maxLength);

    return {
      title: truncatedTitle,
      characterLength: truncatedTitle.length,
      titleType: index % 3 === 0 ? 'how-to' : index % 3 === 1 ? 'listicle' : 'curiosity',
      reasoning: `This ${analysis.keywordOptimized ? 'keyword-optimized' : 'engaging'} title combines ${analysis.curiosityScore > 60 ? 'curiosity' : 'clarity'} with ${analysis.powerWordCount} power words to drive clicks.`,
      ...analysis,
      overallRank: index + 1,
    };
  });
}

/**
 * Generate titles using OpenAI
 */
export async function generateTitlesWithAI(
  input: TitleGeneratorInput
): Promise<TitleVariation[]> {
  if (!client) {
    console.warn('[Title Generator] No OpenAI API key, using mock titles');
    return generateMockTitles(input);
  }

  const { videoTopic, keywords, targetAudience, titleStyle, maxLength } = input;

  const systemPrompt = `You are a YouTube title optimization expert who understands the 2025-2026 algorithm.

🎯 YOUR TASK: Transform the VIDEO TOPIC below into 5 COMPLETELY DIFFERENT, engaging YouTube titles.

⚠️ CRITICAL RULES:
1. STRICT ${maxLength} CHARACTER LIMIT - Every title MUST be under ${maxLength} characters
2. DO NOT just wrap the topic with prefixes like "Why...", "How to...", "The Truth About..."
3. CREATE UNIQUE TITLES - Each should approach the topic from a different angle
4. TRANSFORM the topic into engaging titles, don't just repeat it
5. Primary keyword in first 60 characters (mobile truncation)
6. Use power words strategically but naturally

POWER WORD CATEGORIES:
- Curiosity: Secret, Hidden, Revealed, Exposed, Truth, Nobody, Never
- Urgency: Now, Today, Fast, Quick, Instant, Limited
- Authority: Ultimate, Complete, Best, Top, Proven, Expert
- Emotion: Shocking, Amazing, Incredible, Stunning
- Value: Free, Easy, Simple, Guaranteed, Step-by-step

📝 INPUT:
VIDEO TOPIC: "${videoTopic}"
KEYWORDS TO INCLUDE: ${keywords.join(', ')}
TARGET AUDIENCE: ${targetAudience}
STYLE PREFERENCE: ${titleStyle}

✅ GOOD TITLE EXAMPLES (topic: "AI coding assistants"):
- "I Tried 10 AI Coding Tools - Only 3 Were Worth It"
- "AI Wrote My Code For 30 Days (Results Shocked Me)"
- "Stop Coding Alone: Best AI Partners for Developers"
- "5 AI Coding Secrets Senior Devs Don't Tell You"

❌ BAD TITLE EXAMPLES (just wrapping the topic):
- "Why AI Coding Assistants Are Important"
- "The Truth About AI Coding Assistants"
- "How to AI Coding Assistants"
- "Is AI Coding Assistants Worth It"

🎨 CREATE 5 DIVERSE TITLES:
- Mix different formats: how-to, listicle, personal story, comparison, revelation
- Use numbers when relevant (5 Ways, 10 Tips, 3 Secrets)
- Create curiosity gaps (tease an outcome, revelation, or benefit)
- Make each title feel COMPLETELY DIFFERENT from the others
- Keep them under ${maxLength} characters STRICTLY

For EACH title, return:
{
  "title": "The actual title (max ${maxLength} chars)",
  "titleType": "specific format (how-to, listicle, curiosity, comparison, story, etc.)",
  "reasoning": "Why this title works and how it differs from others"
}

Return ONLY a valid JSON array of 5 unique titles. No markdown, no extra text.`;

  try {
    const raw = await routedChatCompletion(
      client,
      'titles',
      '',
      [{ role: "system", content: systemPrompt }],
      { maxTokens: 2000, temperature: 0.9 },
    );

    let text = raw.trim() || "[]";

    // Clean up response if wrapped in markdown
    if (text.startsWith("```json")) text = text.slice(7);
    if (text.startsWith("```")) text = text.slice(3);
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();

    const parsedTitles = JSON.parse(text) as Array<{
      title: string;
      titleType: string;
      reasoning: string;
    }>;

    if (!Array.isArray(parsedTitles) || parsedTitles.length === 0) {
      throw new Error("Invalid AI response format");
    }

    // Analyze each title and add scores
    const titlesWithScores: TitleVariation[] = parsedTitles.map((item, index) => {
      const truncatedTitle = smartTruncateTitle(item.title, maxLength);
      const analysis = analyzeTitleQuality(truncatedTitle, keywords, maxLength);

      return {
        title: truncatedTitle,
        characterLength: truncatedTitle.length,
        titleType: item.titleType || 'mixed',
        reasoning: item.reasoning || 'AI-generated title optimized for engagement.',
        ...analysis,
        overallRank: 0, // Will be set after sorting
      };
    });

    // Sort by CTR score and assign ranks
    titlesWithScores.sort((a, b) => (b.ctrScore || 0) - (a.ctrScore || 0));
    titlesWithScores.forEach((title, index) => {
      title.overallRank = index + 1;
    });

    return titlesWithScores;
  } catch (error) {
    console.error('[Title Generator] AI generation failed:', error);
    return generateMockTitles(input);
  }
}

/**
 * Generate A/B testing suggestion
 */
export function generateABTestSuggestion(titles: TitleVariation[]): {
  titleA: string;
  titleB: string;
  reason: string;
} {
  if (titles.length < 2) {
    return {
      titleA: titles[0]?.title || '',
      titleB: titles[0]?.title || '',
      reason: 'Not enough titles for A/B testing',
    };
  }

  // Find top curiosity title
  const curiosityTitle = [...titles].sort((a, b) =>
    (b.curiosityScore || 0) - (a.curiosityScore || 0)
  )[0];

  // Find top clarity title
  const clarityTitle = [...titles].sort((a, b) =>
    (b.clarityScore || 0) - (a.clarityScore || 0)
  )[0];

  if (curiosityTitle.title === clarityTitle.title) {
    // Use top 2 overall
    return {
      titleA: titles[0].title,
      titleB: titles[1].title,
      reason: 'Test your top two performing titles to see which resonates better with your audience.',
    };
  }

  return {
    titleA: curiosityTitle.title,
    titleB: clarityTitle.title,
    reason: `Test Curiosity-driven (${curiosityTitle.curiosityScore}/100 curiosity) vs Clarity-focused (${clarityTitle.clarityScore}/100 clarity). Curiosity often wins for entertainment, clarity for educational content.`,
  };
}
