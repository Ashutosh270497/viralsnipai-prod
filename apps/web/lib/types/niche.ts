/**
 * Niche Discovery Types
 *
 * Types for the niche discovery feature including quiz inputs,
 * AI analysis, and niche recommendations.
 */

// Quiz Input Types
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type ContentGoal = 'education' | 'entertainment' | 'reviews' | 'tutorials' | 'vlogs' | 'news';
export type ShowFacePreference = 'yes' | 'no' | 'maybe';
export type CompetitionLevel = 'low' | 'medium' | 'high';
export type GrowthTrend = 'rising' | 'stable' | 'declining';

export interface NicheQuizInputs {
  interests: string[];
  availableHoursPerWeek: number;
  skillLevel: SkillLevel;
  primaryGoal: ContentGoal;
  showFace: ShowFacePreference;
}

// Niche Analysis Request/Response
export interface NicheAnalysisRequest {
  interests: string[];
  availableTime: number;
  skillLevel: SkillLevel;
  goal: ContentGoal;
  showFace: ShowFacePreference;
}

export interface ExampleChannel {
  name: string;
  url: string;
  subscribers: string;
}

export interface NicheRecommendation {
  id: string;
  name: string;
  category: string;
  description: string;
  matchScore: number; // 0-100
  competitionLevel: CompetitionLevel;
  monetizationPotential: number; // 1-10
  averageCPM: number;
  growthTrend: GrowthTrend;
  exampleChannels: ExampleChannel[];
  contentTypes: string[];
  targetAudience: string;
  trendingTopics: string[];
  reasoning: string;
}

// Pre-defined Niche Data
export interface NicheData {
  id: string;
  name: string;
  category: NicheCategory;
  description: string;
  competitionLevel: CompetitionLevel;
  monetizationPotential: number;
  averageCPM: number;
  growthTrend: GrowthTrend;
  exampleChannels: ExampleChannel[];
  contentTypes: string[];
  targetAudience: string;
  keywords: string[];
  requiresFace: boolean;
  minHoursPerWeek: number;
  bestForSkillLevel: SkillLevel[];
}

export type NicheCategory =
  | 'technology'
  | 'gaming'
  | 'education'
  | 'lifestyle'
  | 'finance'
  | 'health'
  | 'entertainment'
  | 'business'
  | 'creative'
  | 'science'
  | 'sports'
  | 'food'
  | 'travel'
  | 'parenting'
  | 'pets'
  | 'automotive'
  | 'music'
  | 'fashion'
  | 'diy'
  | 'news';

export const NICHE_CATEGORIES: { value: NicheCategory; label: string }[] = [
  { value: 'technology', label: 'Technology' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'education', label: 'Education' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'finance', label: 'Finance & Investing' },
  { value: 'health', label: 'Health & Fitness' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'business', label: 'Business' },
  { value: 'creative', label: 'Creative & Art' },
  { value: 'science', label: 'Science' },
  { value: 'sports', label: 'Sports' },
  { value: 'food', label: 'Food & Cooking' },
  { value: 'travel', label: 'Travel' },
  { value: 'parenting', label: 'Parenting & Family' },
  { value: 'pets', label: 'Pets & Animals' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'music', label: 'Music' },
  { value: 'fashion', label: 'Fashion & Beauty' },
  { value: 'diy', label: 'DIY & Crafts' },
  { value: 'news', label: 'News & Commentary' },
];

// Interest Options for Quiz
export const INTEREST_OPTIONS = [
  'Technology & Gadgets',
  'Software & Apps',
  'AI & Machine Learning',
  'Gaming',
  'Personal Finance',
  'Investing & Stocks',
  'Cryptocurrency',
  'Health & Wellness',
  'Fitness & Workouts',
  'Cooking & Recipes',
  'Travel & Adventure',
  'Fashion & Style',
  'Beauty & Skincare',
  'Photography',
  'Video Editing',
  'Music Production',
  'Art & Design',
  'Writing & Storytelling',
  'Business & Entrepreneurship',
  'Marketing & Sales',
  'Productivity & Self-Improvement',
  'Education & Learning',
  'Science & Space',
  'History & Culture',
  'Psychology & Mindset',
  'Parenting & Family',
  'Pets & Animals',
  'Cars & Motorcycles',
  'Sports & Athletics',
  'Comedy & Entertainment',
  'News & Current Events',
  'Politics & Society',
  'Real Estate',
  'DIY & Home Improvement',
  'Gardening',
  'Sustainability & Environment',
];

// Analysis Status
export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export interface AnalysisProgress {
  status: AnalysisStatus;
  step: string;
  progress: number; // 0-100
}

// Filter Options for Manual Browser
export interface NicheFilters {
  category?: NicheCategory;
  competitionLevel?: CompetitionLevel;
  monetizationMin?: number;
  growthTrend?: GrowthTrend;
  search?: string;
}

// Usage tracking
export interface NicheDiscoveryUsage {
  userId: string;
  analysisCount: number;
  lastAnalysisAt?: Date;
  selectedNicheId?: string;
  selectedNicheName?: string;
}
