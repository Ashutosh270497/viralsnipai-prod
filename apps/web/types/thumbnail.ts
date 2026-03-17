import { THUMBNAIL_GENERATION_LIMITS } from "@/lib/billing/plans";

export type ThumbnailStyle = 'bold' | 'minimal' | 'dramatic' | 'informative' | 'meme';
export type MainSubject = 'person' | 'product' | 'text' | 'abstract' | 'split-screen';
export type ColorScheme = 'vibrant' | 'dark' | 'bright' | 'professional' | 'auto';
export type FaceExpression = 'excited' | 'shocked' | 'serious' | 'happy' | 'focused';

export interface ThumbnailGeneratorInput {
  contentIdeaId?: string;
  videoTitle: string;
  niche: string;
  thumbnailStyle: ThumbnailStyle;
  mainSubject: MainSubject;
  colorScheme: ColorScheme;
  includeText: boolean;
  textOverlay?: string; // Max 3-5 words
  faceExpression?: FaceExpression;
  additionalElements?: string[]; // "arrows", "circles", "emojis", etc.
}

export interface ThumbnailAnalysis {
  ctrScore: number; // 1-100 predicted CTR
  contrastScore: number; // 1-10 How well it stands out
  mobileReadability: number; // 1-10 Can you see it on phone?
  emotionalImpact: number; // 1-10 Does it evoke emotion?
  nicheAlignment: number; // 1-10 Fits niche expectations?
  improvements: string[]; // Suggestions to make it better
  reasoning: string; // Why this thumbnail will work
}

export interface GeneratedThumbnail {
  id: string;
  imageUrl: string;
  storagePath: string;
  thumbnailPrompt: string;
  aiModel: string;
  ctrScore: number;
  contrastScore: number;
  mobileReadability: number;
  emotionalImpact: number;
  nicheAlignment: number;
  overallRank: number;
  improvements: string[];
  reasoning: string;
  isPrimary: boolean;
  isFavorite: boolean;
  videoTitle: string;
  thumbnailStyle: string;
  textOverlay?: string;
}

// Design rules and constants
export const THUMBNAIL_RULES = {
  size: { width: 1280, height: 720 }, // 16:9 ratio
  safeZone: {
    // Avoid putting key elements here (profile pic covers it)
    topLeft: { x: 0, y: 0, width: 200, height: 150 },
  },
  textReadability: {
    minFontSize: 80, // Readable on mobile
    maxWords: 5, // Too many words = clutter
    strokeWidth: 8, // Outline for contrast
  },
  colorContrast: {
    minRatio: 4.5, // WCAG AA standard
    vibrantSaturation: 70, // percentage
  },
  focalPoint: {
    rule: 'thirds', // Align main subject on thirds grid
    faceSize: { min: 30, max: 50 }, // percentage of thumbnail
  },
  elements: {
    max: 5, // Too many = cluttered
    minSpacing: 10, // percentage minimum between elements
  },
} as const;

// Style descriptions for DALL-E prompts
export const THUMBNAIL_STYLE_DESCRIPTIONS: Record<ThumbnailStyle, string> = {
  bold: 'High contrast, bright colors, dramatic text, big facial expressions, energetic and eye-catching',
  minimal: 'Clean design, lots of white space, simple typography, 2-3 colors, elegant and professional',
  dramatic: 'Dark background, spotlight effect, intense emotion, cinematic lighting, mysterious atmosphere',
  informative: 'Clear text hierarchy, icons, numbers, professional layout, educational and trustworthy',
  meme: 'Relatable expressions, internet culture, humor, text-heavy, casual and fun',
};

// Color scheme descriptions
export const COLOR_SCHEME_DESCRIPTIONS: Record<ColorScheme, string> = {
  vibrant: 'Bright, saturated colors with high energy (reds, yellows, blues)',
  dark: 'Dark background with bright accents, moody and mysterious',
  bright: 'Light, airy background with colorful elements, cheerful and positive',
  professional: 'Subdued colors, navy/gray tones, corporate and trustworthy',
  auto: 'Let AI choose based on niche and content',
};

// Niche-specific thumbnail best practices
export const NICHE_THUMBNAIL_PATTERNS: Record<string, string> = {
  tech: 'Product-focused, clean background, tech colors (blue/silver), text overlay with specs',
  gaming: 'Character/gameplay screenshot, bold text, energetic colors, reaction face',
  cooking: 'Close-up food shot, bright colors, finished dish prominent, "easy" or time indicator',
  fitness: 'Before/after split, person in action, motivational text, bright background',
  finance: 'Professional look, charts/graphs, dollar signs, serious expression, data-driven',
  tutorial: 'Step indicator (1/2/3), before/after, arrows, "how to" text, clear subject',
  vlog: 'Expressive face, lifestyle setting, colorful background, personal and relatable',
  education: 'Clean layout, numbered points, icons, professional but approachable',
};

// Common thumbnail elements
export const THUMBNAIL_ELEMENTS = [
  'arrows',
  'circles',
  'check marks',
  'X marks',
  'stars',
  'emojis',
  'numbers',
  'question marks',
  'exclamation points',
  'borders',
  'shadows',
  'highlights',
] as const;

export { THUMBNAIL_GENERATION_LIMITS };
