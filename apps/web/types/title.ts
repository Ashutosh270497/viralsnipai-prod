export type TitleStyle = 'how-to' | 'listicle' | 'curiosity' | 'question' | 'authority' | 'mixed';

export interface TitleGeneratorInput {
  contentIdeaId?: string;
  videoTopic: string;
  keywords: string[]; // 3-5 primary keywords
  targetAudience: string;
  titleStyle: TitleStyle;
  maxLength: 60 | 70 | 80; // characters
}

export interface TitleScore {
  ctrScore: number; // 1-100 predicted CTR
  keywordOptimizationScore: number; // 1-100
  curiosityScore: number; // 1-100
  clarityScore: number; // 1-100
  powerWordCount: number; // Count of power words
  lengthOptimal: boolean; // Is it 50-70 chars?
  overallRank: number; // 1-10 based on combined factors
}

export interface TitleVariation extends TitleScore {
  title: string;
  characterLength: number;
  titleType: string; // how-to, listicle, curiosity, etc.
  reasoning: string; // Why this title will work
  keywordOptimized: boolean;
}

export interface GeneratedTitleBatch {
  batchId: string;
  input: TitleGeneratorInput;
  titles: TitleVariation[];
  abTestSuggestion?: {
    titleA: string;
    titleB: string;
    reason: string;
  };
  createdAt: string;
}

export interface SavedTitle {
  id: string;
  userId: string;
  contentIdeaId?: string;
  generationBatchId: string;
  title: string;
  videoTopic: string;
  keywords: string[];
  targetAudience: string;
  titleStyle: TitleStyle;
  maxLength: number;
  characterLength: number;
  ctrScore?: number;
  keywordOptimizationScore?: number;
  curiosityScore?: number;
  clarityScore?: number;
  powerWordCount?: number;
  overallRank?: number;
  reasoning?: string;
  keywordOptimized: boolean;
  lengthOptimal: boolean;
  titleType?: string;
  isFavorite: boolean;
  isPrimary: boolean;
  createdAt: string;
}

// Power words database
export const POWER_WORDS = {
  curiosity: ['secret', 'hidden', 'revealed', 'exposed', 'truth', 'nobody', 'never', 'why', 'what', 'shocking'],
  urgency: ['now', 'today', 'fast', 'quick', 'instant', 'immediately', 'urgent', 'limited', 'hurry', 'soon'],
  authority: ['ultimate', 'complete', 'definitive', 'best', 'top', 'proven', 'expert', 'professional', 'master', 'guide'],
  emotion: ['shocking', 'amazing', 'incredible', 'stunning', 'unbelievable', 'mind-blowing', 'insane', 'crazy', 'epic', 'awesome'],
  value: ['free', 'easy', 'simple', 'proven', 'guaranteed', 'step-by-step', 'beginners', 'advanced', 'tips', 'tricks'],
  negative: ['mistake', 'wrong', 'avoid', 'stop', 'never', 'worst', 'fail', 'bad', 'problem', 'warning'],
} as const;

// Title formulas/templates
export const TITLE_FORMULAS = {
  'how-to': [
    'How to {benefit} in {timeframe} ({result})',
    'How to {action} Without {problem}',
    'The Complete Guide to {topic}',
    '{number} Steps to {result}',
    'How to {action} Like a Pro',
  ],
  listicle: [
    '{number} {thing} Every {audience} Needs to Know',
    'Top {number} {category} in {year}',
    '{number} {adjective} Ways to {action}',
    '{number} Proven {thing} for {result}',
    '{number} {thing} That Will {benefit}',
  ],
  curiosity: [
    'Why {surprising-fact} (Explained)',
    'The {adjective} Truth About {topic}',
    'What {authority} Won\'t Tell You About {topic}',
    '{thing} vs {thing}: Which is Better?',
    'I Tried {activity} for {time} - Here\'s What Happened',
  ],
  question: [
    'Is {thing} Worth It in {year}?',
    'Can You Really {claim}?',
    'Should You {action}? (Honest Answer)',
    'What Happens When You {action}?',
    'Why Does {thing} {happen}?',
  ],
  authority: [
    'The Ultimate {topic} Guide ({year})',
    '{topic}: Everything You Need to Know',
    'The Definitive Guide to {action}',
    'Master {skill} in {timeframe}',
    'The Only {thing} You\'ll Ever Need',
  ],
  mixed: [
    'Stop {wrong-way}! Do {right-way} Instead',
    '{question}? (The Answer Will Surprise You)',
    'The Truth About {topic} Nobody Tells You',
    '{number} {thing} That Actually Work',
    'Before You {action}, Watch This',
  ],
} as const;
