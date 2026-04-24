/**
 * Zod validation schemas for API routes and forms
 *
 * Provides type-safe validation with detailed error messages.
 * Import and use these schemas in API routes and form components.
 */

import { z } from 'zod';
import {
  UPLOAD_LIMITS,
  ACCEPTED_FILE_TYPES,
  CLIP_CONSTRAINTS,
  IMAGEN_DEFAULTS,
  VEO_DEFAULTS,
  HOOKSMITH_DEFAULTS
} from './constants';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Valid CUID format
 */
export const cuidSchema = z.string().cuid();

/**
 * Valid URL
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * YouTube URL (various formats)
 */
export const youtubeUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
        /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
      ];
      return patterns.some((pattern) => pattern.test(url));
    },
    { message: 'Invalid YouTube URL' }
  );

/**
 * Email address
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Hex color code
 */
export const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color code');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

// =============================================================================
// PROJECT SCHEMAS
// =============================================================================

export const targetPlatformSchema = z.enum([
  'youtube_shorts',
  'instagram_reels',
  'tiktok',
  'linkedin',
  'x'
]);

export const contentGoalSchema = z.enum([
  'more_reach',
  'more_leads',
  'faster_editing',
  'repurpose_long_form',
  'personal_brand'
]);

export const createProjectSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  topic: z.string().max(500, 'Topic must be 500 characters or less').optional(),
  sourceUrl: urlSchema.optional(),
  targetPlatform: targetPlatformSchema.optional(),
  contentGoal: contentGoalSchema.optional()
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  topic: z.string().max(500).optional(),
  sourceUrl: urlSchema.optional(),
  targetPlatform: targetPlatformSchema.optional(),
  contentGoal: contentGoalSchema.optional()
});

export const updateScriptSchema = z.object({
  hooks: z.array(z.string()).min(1, 'At least one hook is required'),
  body: z.string().min(1, 'Script body is required'),
  tone: z.string().max(50).optional()
});

// =============================================================================
// HOOKSMITH SCHEMAS
// =============================================================================

export const generateHooksSchema = z.object({
  topic: z
    .string()
    .min(3, 'Topic must be at least 3 characters')
    .max(500, 'Topic must be 500 characters or less'),
  sourceUrl: urlSchema.optional(),
  count: z.number().int().min(3).max(15).default(HOOKSMITH_DEFAULTS.HOOKS_COUNT)
});

export const expandScriptSchema = z.object({
  hook: z.string().min(3, 'Hook must be at least 3 characters').max(500),
  topic: z.string().min(3).max(500),
  tone: z.enum(['casual', 'professional', 'engaging', 'humorous', 'educational']).optional(),
  targetLengthSec: z
    .number()
    .int()
    .min(30)
    .max(300)
    .default(HOOKSMITH_DEFAULTS.SCRIPT_LENGTH_SEC)
});

// =============================================================================
// REPURPOSE SCHEMAS
// =============================================================================

export const ingestVideoSchema = z.object({
  projectId: cuidSchema,
  sourceType: z.enum(['upload', 'youtube']),
  sourceUrl: z.string().optional(),
  filename: z.string().optional()
}).refine(
  (data) => {
    if (data.sourceType === 'youtube') {
      return !!data.sourceUrl;
    }
    return true;
  },
  {
    message: 'Source URL is required for YouTube ingestion',
    path: ['sourceUrl']
  }
);

export const generateHighlightsSchema = z.object({
  assetId: cuidSchema,
  targetCount: z
    .number()
    .int()
    .min(CLIP_CONSTRAINTS.MIN_COUNT)
    .max(CLIP_CONSTRAINTS.MAX_COUNT)
    .optional(),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'gemini-pro']).optional()
});

export const generateCaptionsSchema = z.object({
  assetId: cuidSchema,
  language: z.string().default('en')
});

export const updateClipSchema = z.object({
  title: z.string().max(200).optional(),
  summary: z.string().max(1000).optional(),
  callToAction: z.string().max(200).optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().positive().optional()
}).refine(
  (data) => {
    if (data.startMs !== undefined && data.endMs !== undefined) {
      return data.endMs > data.startMs;
    }
    return true;
  },
  {
    message: 'End time must be greater than start time',
    path: ['endMs']
  }
);

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

export const createExportSchema = z.object({
  projectId: cuidSchema,
  clipIds: z.array(cuidSchema).min(1, 'At least one clip is required'),
  preset: z.enum(['shorts_9x16_1080', 'square_1x1_1080', 'portrait_4x5_1080', 'landscape_16x9_1080']),
  includeCaptions: z.boolean().default(false),
  applyBranding: z.boolean().default(true)
});

// =============================================================================
// BRAND KIT SCHEMAS
// =============================================================================

export const updateBrandKitSchema = z.object({
  primaryHex: hexColorSchema.optional(),
  fontFamily: z.string().max(100).optional(),
  watermark: z.boolean().optional(),
  captionStyle: z
    .object({
      fontSize: z.number().int().min(8).max(72).optional(),
      fontFamily: z.string().max(100).optional(),
      color: hexColorSchema.optional(),
      backgroundColor: z.string().max(50).optional(),
      position: z.enum(['top', 'center', 'bottom']).optional()
    })
    .optional()
});

// =============================================================================
// IMAGEN SCHEMAS
// =============================================================================

const base64ImageSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64 encoding')
  .refine(
    (val) => {
      try {
        const decoded = Buffer.from(val, 'base64');
        return decoded.length <= UPLOAD_LIMITS.MAX_REFERENCE_IMAGE_SIZE;
      } catch {
        return false;
      }
    },
    { message: `Image must be smaller than ${UPLOAD_LIMITS.MAX_REFERENCE_IMAGE_SIZE / 1024 / 1024}MB` }
  );

export const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(3, 'Prompt must be at least 3 characters')
    .max(IMAGEN_DEFAULTS.MAX_PROMPT_LENGTH, `Prompt must be ${IMAGEN_DEFAULTS.MAX_PROMPT_LENGTH} characters or less`)
    .regex(/^[\w\s.,!?'-]+$/, 'Prompt contains invalid characters'),
  negativePrompt: z
    .string()
    .max(IMAGEN_DEFAULTS.MAX_NEGATIVE_PROMPT_LENGTH)
    .optional(),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).default(IMAGEN_DEFAULTS.ASPECT_RATIO as '1:1'),
  quality: z.enum(['standard', 'premium']).default(IMAGEN_DEFAULTS.QUALITY as 'standard'),
  count: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(IMAGEN_DEFAULTS.COUNT),
  stylePreset: z.string().max(100).optional(),
  seed: z.number().int().positive().optional(),
  referenceImages: z
    .array(
      z.object({
        mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
        base64: base64ImageSchema,
        filename: z.string().max(255).optional()
      })
    )
    .max(UPLOAD_LIMITS.MAX_REFERENCE_IMAGES, `Maximum ${UPLOAD_LIMITS.MAX_REFERENCE_IMAGES} reference images allowed`)
    .optional()
});

// =============================================================================
// VEO SCHEMAS
// =============================================================================

export const generateVideoSchema = z.object({
  prompt: z
    .string()
    .min(3, 'Prompt must be at least 3 characters')
    .max(2000, 'Prompt must be 2000 characters or less'),
  negativePrompt: z.string().max(500).optional(),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).default(VEO_DEFAULTS.ASPECT_RATIO as '9:16'),
  durationSec: z
    .number()
    .int()
    .min(VEO_DEFAULTS.MIN_DURATION_SEC)
    .max(VEO_DEFAULTS.MAX_DURATION_SEC)
    .default(VEO_DEFAULTS.DURATION_SEC),
  stylePreset: z.string().max(100).optional(),
  seed: z.number().int().positive().optional()
});

// =============================================================================
// TRANSCRIPTION SCHEMAS
// =============================================================================

export const createTranscriptJobSchema = z.object({
  sourceType: z.enum(['upload', 'youtube']),
  sourceUrl: youtubeUrlSchema.optional(),
  title: z.string().max(200).optional(),
  language: z.string().length(2).default('en')
}).refine(
  (data) => {
    if (data.sourceType === 'youtube') {
      return !!data.sourceUrl;
    }
    return true;
  },
  {
    message: 'Source URL is required for YouTube transcription',
    path: ['sourceUrl']
  }
);

export const textToSpeechSchema = z.object({
  text: z
    .string()
    .min(1, 'Text is required')
    .max(5000, 'Text must be 5000 characters or less'),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  model: z.enum(['tts-1', 'tts-1-hd']).default('tts-1')
});

// =============================================================================
// VOICER SCHEMAS
// =============================================================================

export const createVoiceProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sampleAudioBase64: z.string().optional()
});

export const generateSpeechSchema = z.object({
  voiceId: cuidSchema,
  text: z
    .string()
    .min(1, 'Text is required')
    .max(5000, 'Text must be 5000 characters or less'),
  stability: z.number().min(0).max(1).default(0.5),
  similarityBoost: z.number().min(0).max(1).default(0.75)
});

// =============================================================================
// FILE UPLOAD SCHEMAS
// =============================================================================

export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().int().positive()
}).refine(
  (data) => {
    // Validate file size based on type
    if (data.mimeType.startsWith('video/')) {
      return data.size <= UPLOAD_LIMITS.MAX_VIDEO_SIZE;
    }
    if (data.mimeType.startsWith('audio/')) {
      return data.size <= UPLOAD_LIMITS.MAX_AUDIO_SIZE;
    }
    if (data.mimeType.startsWith('image/')) {
      return data.size <= UPLOAD_LIMITS.MAX_REFERENCE_IMAGE_SIZE;
    }
    return true;
  },
  {
    message: 'File size exceeds maximum allowed size',
    path: ['size']
  }
);

// =============================================================================
// AUTHENTICATION SCHEMAS
// =============================================================================

export const signupSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional()
});

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

export const resetPasswordSchema = z.object({
  email: emailSchema
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  }
);

// =============================================================================
// ONBOARDING SCHEMAS
// =============================================================================

export const onboardingStep1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  youtubeChannelUrl: z
    .string()
    .url('Invalid URL format')
    .regex(
      /^https?:\/\/(www\.)?(youtube\.com\/@[\w-]+|youtube\.com\/channel\/[\w-]+|youtube\.com\/c\/[\w-]+|youtube\.com\/user\/[\w-]+)$/,
      'Invalid YouTube channel URL'
    )
    .optional()
    .or(z.literal('')),
  subscriberCount: z.enum([
    '0-1k',
    '1k-10k',
    '10k-100k',
    '100k-1m',
    '1m+'
  ])
});

export const onboardingStep2Schema = z.object({
  goalSelection: z.enum([
    'start_channel',
    'grow_channel',
    'monetization',
    'professional'
  ])
});

export const onboardingStep3Schema = z.object({
  nicheInterests: z
    .array(z.string())
    .min(1, 'Please select at least one niche interest')
    .max(10, 'Please select no more than 10 niche interests')
});

export const completeOnboardingSchema = z.object({
  name: z.string().min(2).max(100),
  youtubeChannelUrl: z.string().optional().or(z.literal('')),
  subscriberCount: z.string(),
  goalSelection: z.enum([
    'start_channel',
    'grow_channel',
    'monetization',
    'professional'
  ]),
  nicheInterests: z.array(z.string()).min(1)
});

export const creatorTypeSchema = z.enum([
  'founder',
  'coach',
  'agency',
  'youtuber',
  'podcaster',
  'marketer',
  'other'
]);

export const primaryPlatformSchema = z.enum([
  'youtube_shorts',
  'instagram_reels',
  'tiktok',
  'linkedin',
  'x'
]);

/**
 * V1 onboarding — the new focused flow that collects creator type, primary platform,
 * content niche, and main goal. Replaces the legacy YouTube-first onboarding.
 */
export const v1OnboardingStep1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  creatorType: creatorTypeSchema
});

export const v1OnboardingStep2Schema = z.object({
  primaryPlatform: primaryPlatformSchema,
  contentNiche: z.string().min(2, 'Tell us your content niche').max(120)
});

export const v1OnboardingStep3Schema = z.object({
  contentGoal: contentGoalSchema
});

export const v1CompleteOnboardingSchema = z.object({
  name: z.string().min(2).max(100),
  creatorType: creatorTypeSchema,
  primaryPlatform: primaryPlatformSchema,
  contentNiche: z.string().min(2).max(120),
  contentGoal: contentGoalSchema
});

// =============================================================================
// NICHE DISCOVERY SCHEMAS
// =============================================================================

export const nicheQuizSchema = z.object({
  interests: z
    .array(z.string())
    .min(2, 'Please select at least 2 interests')
    .max(5, 'Please select no more than 5 interests'),
  availableHoursPerWeek: z
    .number()
    .int()
    .min(2, 'Minimum 2 hours per week')
    .max(40, 'Maximum 40 hours per week'),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  primaryGoal: z.enum(['education', 'entertainment', 'reviews', 'tutorials', 'vlogs', 'news']),
  showFace: z.enum(['yes', 'no', 'maybe'])
});

export const nicheAnalysisRequestSchema = z.object({
  interests: z
    .array(z.string())
    .min(2)
    .max(5),
  availableTime: z
    .number()
    .int()
    .min(2)
    .max(40),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: z.enum(['education', 'entertainment', 'reviews', 'tutorials', 'vlogs', 'news']),
  showFace: z.enum(['yes', 'no', 'maybe'])
});

export const nicheSelectSchema = z.object({
  nicheId: z.string().min(1, 'Niche ID is required'),
  nicheName: z.string().min(1, 'Niche name is required')
});

export const nicheFilterSchema = z.object({
  category: z
    .enum([
      'technology',
      'gaming',
      'education',
      'lifestyle',
      'finance',
      'health',
      'entertainment',
      'business',
      'creative',
      'science',
      'sports',
      'food',
      'travel',
      'parenting',
      'pets',
      'automotive',
      'music',
      'fashion',
      'diy',
      'news'
    ])
    .optional(),
  competitionLevel: z.enum(['low', 'medium', 'high']).optional(),
  monetizationMin: z.number().int().min(1).max(10).optional(),
  growthTrend: z.enum(['rising', 'stable', 'declining']).optional(),
  faceless: z.boolean().optional(),
  search: z.string().max(100).optional()
});

// =============================================================================
// SNIPRADAR SCHEMAS
// =============================================================================

export const addTrackedAccountSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  niche: z.string().max(100).optional()
});

export const snipRadarUpdateDraftSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  status: z.enum(['draft', 'rejected']).optional()
});

export const viralFeedFilterSchema = z.object({
  filter: z.enum(['all', 'analyzed', 'unanalyzed']).default('all'),
  sort: z.enum(['score', 'likes', 'recent']).default('score'),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const draftListFilterSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'posted', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Export inferred types for use in TypeScript
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateScriptInput = z.infer<typeof updateScriptSchema>;
export type GenerateHooksInput = z.infer<typeof generateHooksSchema>;
export type ExpandScriptInput = z.infer<typeof expandScriptSchema>;
export type IngestVideoInput = z.infer<typeof ingestVideoSchema>;
export type GenerateHighlightsInput = z.infer<typeof generateHighlightsSchema>;
export type GenerateCaptionsInput = z.infer<typeof generateCaptionsSchema>;
export type UpdateClipInput = z.infer<typeof updateClipSchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type UpdateBrandKitInput = z.infer<typeof updateBrandKitSchema>;
export type GenerateImageInput = z.infer<typeof generateImageSchema>;
export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
export type CreateTranscriptJobInput = z.infer<typeof createTranscriptJobSchema>;
export type TextToSpeechInput = z.infer<typeof textToSpeechSchema>;
export type CreateVoiceProfileInput = z.infer<typeof createVoiceProfileSchema>;
export type GenerateSpeechInput = z.infer<typeof generateSpeechSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
export type OnboardingStep1Input = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2Input = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3Input = z.infer<typeof onboardingStep3Schema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type CreatorType = z.infer<typeof creatorTypeSchema>;
export type PrimaryPlatform = z.infer<typeof primaryPlatformSchema>;
export type ContentGoal = z.infer<typeof contentGoalSchema>;
export type TargetPlatform = z.infer<typeof targetPlatformSchema>;
export type V1OnboardingStep1Input = z.infer<typeof v1OnboardingStep1Schema>;
export type V1OnboardingStep2Input = z.infer<typeof v1OnboardingStep2Schema>;
export type V1OnboardingStep3Input = z.infer<typeof v1OnboardingStep3Schema>;
export type V1CompleteOnboardingInput = z.infer<typeof v1CompleteOnboardingSchema>;
export type NicheQuizInput = z.infer<typeof nicheQuizSchema>;
export type NicheAnalysisRequestInput = z.infer<typeof nicheAnalysisRequestSchema>;
export type NicheSelectInput = z.infer<typeof nicheSelectSchema>;
export type NicheFilterInput = z.infer<typeof nicheFilterSchema>;
export type AddTrackedAccountInput = z.infer<typeof addTrackedAccountSchema>;
export type SnipRadarUpdateDraftInput = z.infer<typeof snipRadarUpdateDraftSchema>;
export type ViralFeedFilterInput = z.infer<typeof viralFeedFilterSchema>;
export type DraftListFilterInput = z.infer<typeof draftListFilterSchema>;
