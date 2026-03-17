import OpenAI from 'openai';
import {
  ThumbnailGeneratorInput,
  ThumbnailAnalysis,
  THUMBNAIL_STYLE_DESCRIPTIONS,
  COLOR_SCHEME_DESCRIPTIONS,
  NICHE_THUMBNAIL_PATTERNS,
  THUMBNAIL_RULES,
} from '@/types/thumbnail';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Build optimized DALL-E 3 prompt for YouTube thumbnail generation
 */
export function buildThumbnailPrompt(input: ThumbnailGeneratorInput): string {
  const styleDescription = THUMBNAIL_STYLE_DESCRIPTIONS[input.thumbnailStyle];
  const colorDescription = COLOR_SCHEME_DESCRIPTIONS[input.colorScheme];
  const nichePattern = NICHE_THUMBNAIL_PATTERNS[input.niche.toLowerCase()] || '';

  const basePrompt = `Create a professional, high-CTR YouTube thumbnail image in ${input.thumbnailStyle} style.

CRITICAL DESIGN REQUIREMENTS:
- 16:9 aspect ratio (1280x720 pixels)
- High contrast and saturation (must stand out in search results)
- Clear focal point (viewer's eye drawn immediately)
- Readable on mobile devices (large elements, bold colors)
- Professional quality (not amateur or cluttered)
- Maximum 3-5 visual elements

VIDEO CONTEXT:
Title: "${input.videoTitle}"
Niche: ${input.niche}
${nichePattern ? `Niche Best Practice: ${nichePattern}` : ''}

VISUAL STYLE:
${styleDescription}

COLOR SCHEME:
${colorDescription}

MAIN SUBJECT:
${input.mainSubject === 'person' ? 'Center the composition around a person' : ''}
${input.mainSubject === 'product' ? 'Feature the product prominently (70% of frame)' : ''}
${input.mainSubject === 'text' ? 'Text should be the primary visual element' : ''}
${input.mainSubject === 'abstract' ? 'Use abstract shapes and patterns' : ''}
${input.mainSubject === 'split-screen' ? 'Use before/after or comparison split-screen layout' : ''}

${input.faceExpression ? `FACIAL EXPRESSION: ${input.faceExpression} expression - exaggerated for impact` : ''}

${input.includeText && input.textOverlay ? `TEXT OVERLAY: "${input.textOverlay}"
- Font size: VERY LARGE (readable from 10 feet away)
- Bold, sans-serif font (like Impact or Bebas Neue)
- White text with thick black stroke/outline
- Position: Top third or bottom third of thumbnail
- Max 3-5 words, ALL CAPS for impact` : 'DO NOT include any text overlays'}

${input.additionalElements && input.additionalElements.length > 0 ? `
ADDITIONAL ELEMENTS:
Include these visual elements strategically:
${input.additionalElements.map(el => `- ${el}`).join('\n')}
` : ''}

DESIGN RULES TO FOLLOW:
1. Avoid the top-left corner (YouTube profile picture covers it)
2. Use rule of thirds for composition
3. Ensure ${THUMBNAIL_RULES.colorContrast.minRatio}:1 color contrast ratio
4. Maximum ${THUMBNAIL_RULES.elements.max} distinct elements
5. No small text or fine details (won't be visible)
6. Vibrant saturation above ${THUMBNAIL_RULES.colorContrast.vibrantSaturation}%

WHAT MAKES THIS CLICK-WORTHY:
- Creates curiosity gap (makes viewer want to know more)
- Emotionally engaging (triggers reaction)
- Clearly communicates video topic
- Stands out from competing thumbnails
- Professional and trustworthy

Generate a thumbnail that stops scrolling and gets clicks!`;

  return basePrompt;
}

/**
 * Generate thumbnail using DALL-E 3
 */
export async function generateThumbnailImage(
  input: ThumbnailGeneratorInput
): Promise<{ imageUrl: string; revisedPrompt: string }> {
  const prompt = buildThumbnailPrompt(input);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024', // Closest to 16:9 ratio available
      quality: 'hd',
      style: input.thumbnailStyle === 'minimal' || input.thumbnailStyle === 'informative' ? 'natural' : 'vivid',
    });

    const imageUrl = response.data?.[0]?.url;
    const revisedPrompt = response.data?.[0]?.revised_prompt || prompt;

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    return { imageUrl, revisedPrompt };
  } catch (error: any) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

/**
 * Analyze thumbnail quality and predict CTR using algorithmic scoring.
 */
export async function analyzeThumbnail(
  input: ThumbnailGeneratorInput,
  _imageUrl: string
): Promise<ThumbnailAnalysis> {
  return generateFallbackAnalysis(input);
}

/**
 * Fallback analysis using algorithmic scoring
 */
function generateFallbackAnalysis(input: ThumbnailGeneratorInput): ThumbnailAnalysis {
  let ctrScore = 50; // Base score
  let contrastScore = 6;
  let mobileReadability = 6;
  let emotionalImpact = 5;
  let nicheAlignment = 6;
  const improvements: string[] = [];

  // Style bonuses
  if (input.thumbnailStyle === 'bold') {
    ctrScore += 15;
    contrastScore += 2;
    improvements.push('Bold style chosen - excellent for catching attention in feed');
  }
  if (input.thumbnailStyle === 'dramatic') {
    ctrScore += 10;
    emotionalImpact += 2;
    improvements.push('Dramatic style creates emotional impact');
  }
  if (input.thumbnailStyle === 'minimal') {
    mobileReadability += 2;
    improvements.push('Minimal style ensures clarity on small screens');
  }

  // Text overlay bonus
  if (input.includeText && input.textOverlay) {
    const wordCount = input.textOverlay.split(' ').length;
    if (wordCount <= 3) {
      ctrScore += 12;
      mobileReadability += 2;
      improvements.push(`Concise text overlay (${wordCount} words) is perfect for mobile`);
    } else if (wordCount <= 5) {
      ctrScore += 8;
      mobileReadability += 1;
    } else {
      improvements.push('Consider reducing text to 3-5 words for better mobile readability');
    }
  } else {
    improvements.push('Adding a short text overlay (2-3 words) could improve CTR');
  }

  // Face expression bonus
  if (input.faceExpression) {
    ctrScore += 12;
    emotionalImpact += 3;
    if (input.faceExpression === 'shocked' || input.faceExpression === 'excited') {
      ctrScore += 3;
      improvements.push(`${input.faceExpression} expression is highly engaging`);
    }
  } else if (input.mainSubject === 'person') {
    improvements.push('Adding a specific face expression can boost engagement');
  }

  // Color scheme bonuses
  if (input.colorScheme === 'vibrant') {
    ctrScore += 10;
    contrastScore += 2;
    improvements.push('Vibrant colors stand out in search results');
  }
  if (input.colorScheme === 'dark') {
    ctrScore += 5;
    emotionalImpact += 1;
  }
  if (input.colorScheme === 'bright') {
    mobileReadability += 1;
  }

  // Main subject bonuses
  if (input.mainSubject === 'person') {
    emotionalImpact += 2;
    nicheAlignment += 1;
  }
  if (input.mainSubject === 'split-screen') {
    ctrScore += 8;
    improvements.push('Split-screen layout creates curiosity gap');
  }

  // Niche-specific adjustments
  const nicheLower = input.niche.toLowerCase();
  if (nicheLower.includes('tech') || nicheLower.includes('review')) {
    if (input.mainSubject === 'product') nicheAlignment += 2;
    if (input.thumbnailStyle === 'informative') nicheAlignment += 1;
  }
  if (nicheLower.includes('gaming')) {
    if (input.thumbnailStyle === 'bold') nicheAlignment += 2;
    if (input.colorScheme === 'vibrant') nicheAlignment += 1;
  }
  if (nicheLower.includes('education') || nicheLower.includes('tutorial')) {
    if (input.thumbnailStyle === 'informative') nicheAlignment += 2;
    if (input.includeText) nicheAlignment += 1;
  }

  // Cap scores at maximum values
  ctrScore = Math.min(100, Math.max(1, ctrScore));
  contrastScore = Math.min(10, Math.max(1, contrastScore));
  mobileReadability = Math.min(10, Math.max(1, mobileReadability));
  emotionalImpact = Math.min(10, Math.max(1, emotionalImpact));
  nicheAlignment = Math.min(10, Math.max(1, nicheAlignment));

  // Add general improvements if list is short
  if (improvements.length < 2) {
    improvements.push('Test thumbnail at 320px width to verify mobile readability');
    improvements.push('Ensure key elements avoid top-left corner (profile pic covers it)');
  }

  const reasoning = `This ${input.thumbnailStyle} thumbnail with ${input.colorScheme} colors is optimized for ${input.niche} content. ` +
    `The ${input.mainSubject} focus${input.includeText ? ' combined with text overlay' : ''} creates visual appeal. ` +
    `Based on YouTube best practices, this thumbnail should achieve ${ctrScore >= 70 ? 'good' : 'moderate'} engagement.`;

  return {
    ctrScore,
    contrastScore,
    mobileReadability,
    emotionalImpact,
    nicheAlignment,
    improvements: improvements.slice(0, 5), // Max 5 improvements
    reasoning,
  };
}

/**
 * Generate multiple thumbnail variations
 */
export async function generateThumbnailVariations(
  input: ThumbnailGeneratorInput,
  count: number = 3
): Promise<Array<{ imageUrl: string; revisedPrompt: string; analysis: ThumbnailAnalysis }>> {
  console.log(`[Thumbnail Generator] Starting generation of ${count} variations...`);
  const variations = [];

  for (let i = 0; i < count; i++) {
    console.log(`[Thumbnail Generator] Generating variation ${i + 1}/${count}...`);

    // Slightly vary the prompt for each variation
    const variedInput = { ...input };

    // Add variation hints to the additional elements
    const variationHints = [
      'slightly different composition',
      'alternative color emphasis',
      'different focal point placement',
    ];

    if (!variedInput.additionalElements) {
      variedInput.additionalElements = [];
    }
    variedInput.additionalElements.push(variationHints[i % variationHints.length]);

    try {
      const { imageUrl, revisedPrompt } = await generateThumbnailImage(variedInput);
      const analysis = await analyzeThumbnail(input, imageUrl);

      variations.push({
        imageUrl,
        revisedPrompt,
        analysis,
      });

      console.log(`[Thumbnail Generator] Variation ${i + 1} complete (CTR: ${analysis.ctrScore})`);
    } catch (error: any) {
      console.error(`[Thumbnail Generator] Failed to generate variation ${i + 1}:`, error.message);
      throw error; // Re-throw to stop generation
    }

    // Small delay to avoid rate limiting
    if (i < count - 1) {
      console.log('[Thumbnail Generator] Waiting 2 seconds before next generation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Sort by CTR score (highest first)
  const sorted = variations.sort((a, b) => b.analysis.ctrScore - a.analysis.ctrScore);
  console.log(`[Thumbnail Generator] All ${count} variations generated and ranked`);

  return sorted;
}
