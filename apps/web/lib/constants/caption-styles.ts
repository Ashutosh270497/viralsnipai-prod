/**
 * Caption Style Constants
 *
 * Centralized caption style definitions and aggressiveness levels.
 * Shared across caption-style-selector and brand-kit components.
 *
 * @module caption-styles
 */

export interface CaptionStyleColors {
  power: string;
  number: string;
  emotion: string;
}

export interface CaptionStyle {
  id: string;
  name: string;
  description: string;
  preview: string;
  colors: CaptionStyleColors;
}

export interface AggressivenessLevel {
  value: string;
  label: string;
  description: string;
}

/**
 * Available caption styles
 */
export const CAPTION_STYLES: readonly CaptionStyle[] = [
  {
    id: "modern",
    name: "Minimal Clean",
    description: "Clean, professional look with subtle highlights",
    preview: "Professional",
    colors: {
      power: "#FFD700",
      number: "#00FF88",
      emotion: "#FF6B9D"
    }
  },
  {
    id: "viral",
    name: "Hormozi Bold",
    description: "Bold high-contrast captions for fast short-form hooks",
    preview: "Attention-Grabbing",
    colors: {
      power: "#FFD700",
      number: "#00FF88",
      emotion: "#FF3366"
    }
  },
  {
    id: "minimal",
    name: "Podcast Subtitle",
    description: "Subtle emphasis without colors, focus on typography",
    preview: "Clean & Simple",
    colors: {
      power: "#FFFFFF",
      number: "#FFFFFF",
      emotion: "#FFFFFF"
    }
  },
  {
    id: "gaming",
    name: "Gaming Reaction",
    description: "Bold, energetic style with strong highlights",
    preview: "Energetic",
    colors: {
      power: "#FF0000",
      number: "#00FF00",
      emotion: "#FF00FF"
    }
  },
  {
    id: "business",
    name: "News Explainer",
    description: "Professional look with conservative highlights",
    preview: "Corporate",
    colors: {
      power: "#4A90E2",
      number: "#50C878",
      emotion: "#E94B3C"
    }
  },
  {
    id: "karaoke",
    name: "Karaoke Highlight",
    description: "Word-by-word emphasis for high-retention clips",
    preview: "Word Highlight",
    colors: {
      power: "#FFFFFF",
      number: "#38BDF8",
      emotion: "#FACC15"
    }
  },
  {
    id: "creator_pop",
    name: "Creator Pop",
    description: "Bright creator-style captions with punchy emphasis",
    preview: "Creator Pop",
    colors: {
      power: "#FFFFFF",
      number: "#22C55E",
      emotion: "#F97316"
    }
  },
  {
    id: "none",
    name: "No Captions",
    description: "Disable burned captions while keeping downloadable SRT/VTT",
    preview: "Clean Video",
    colors: {
      power: "#FFFFFF",
      number: "#FFFFFF",
      emotion: "#FFFFFF"
    }
  }
] as const;

/**
 * Aggressiveness levels for caption highlighting
 */
export const AGGRESSIVENESS_LEVELS: readonly AggressivenessLevel[] = [
  {
    value: "subtle",
    label: "Subtle",
    description: "Minimal highlights"
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balanced emphasis"
  },
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Maximum impact"
  }
] as const;

/**
 * Type for style IDs
 */
export type CaptionStyleId = typeof CAPTION_STYLES[number]['id'];

/**
 * Type for aggressiveness values
 */
export type AggressivenessValue = typeof AGGRESSIVENESS_LEVELS[number]['value'];

/**
 * Get a caption style by ID
 */
export function getCaptionStyle(id: string): CaptionStyle | undefined {
  return CAPTION_STYLES.find(style => style.id === id);
}

/**
 * Get an aggressiveness level by value
 */
export function getAggressivenessLevel(value: string): AggressivenessLevel | undefined {
  return AGGRESSIVENESS_LEVELS.find(level => level.value === value);
}
