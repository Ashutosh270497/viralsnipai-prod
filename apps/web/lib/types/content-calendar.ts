/**
 * Content Calendar Types
 *
 * Type definitions for the 30-Day Content Calendar Generator feature
 */

export type VideoType = 'short' | 'long-form';
export type ContentCategory = 'trending' | 'evergreen' | 'experimental';
export type IdeaStatus = 'idea' | 'scripted' | 'published';
export type CalendarStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface VideoIdea {
  id: string;
  title: string;
  description: string;
  videoType: VideoType;
  viralityScore: number; // 1-100
  keywords: string[];
  searchVolume: number;
  competitionScore: number; // 1-10
  estimatedViews: number;
  contentCategory: ContentCategory;
  reasoning: string; // Why this idea will work
  scheduledDate: Date;
  hookSuggestions: string[]; // 3-5 hook ideas
  thumbnailIdeas: string[]; // Description of thumbnail concepts
  status: IdeaStatus;
  niche?: string;
  calendarId?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentCalendar {
  id: string;
  userId: string;
  niche: string;
  startDate: Date;
  endDate: Date;
  durationDays: number; // 7, 14, or 30
  generationStatus: CalendarStatus;
  metadata?: {
    userSkillLevel?: string;
    targetAudience?: string;
    competitionLevel?: string;
  };
  ideas: VideoIdea[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateCalendarRequest {
  userId: string;
  niche: string;
  startDate: Date;
  durationDays: number; // 7, 14, or 30
  nicheData?: {
    targetAudience?: string;
    competitionLevel?: string;
    monetizationPotential?: number;
    keywords?: string[];
  };
  userSkillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface GenerateCalendarResponse {
  calendarId: string;
  ideas: VideoIdea[];
  stats: {
    totalIdeas: number;
    trendingCount: number;
    evergreenCount: number;
    experimentalCount: number;
    shortFormCount: number;
    longFormCount: number;
    averageViralityScore: number;
  };
}

export interface ViralityFactors {
  searchVolume: number; // 30% weight
  competitionLevel: number; // 20% weight
  trendMomentum: number; // 20% weight
  engagementPotential: number; // 20% weight
  algorithmicAlignment: number; // 10% weight
}

export interface CalendarDay {
  date: Date;
  ideas: VideoIdea[];
}

export interface CalendarFilters {
  videoType?: VideoType;
  contentCategory?: ContentCategory;
  minViralityScore?: number;
  status?: IdeaStatus;
}
