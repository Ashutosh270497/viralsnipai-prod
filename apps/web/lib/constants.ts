/**
 * Application-wide constants
 *
 * Centralizes all magic numbers and configuration values used throughout the app.
 * Prefer importing from this file rather than using hard-coded values.
 */

// =============================================================================
// UPLOAD & FILE CONSTRAINTS
// =============================================================================

export const UPLOAD_LIMITS = {
  /** Maximum size for reference images (20MB in bytes) */
  MAX_REFERENCE_IMAGE_SIZE: 20 * 1024 * 1024,
  /** Maximum number of reference images allowed per generation */
  MAX_REFERENCE_IMAGES: 5,
  /** Maximum video file size for upload (500MB in bytes) */
  MAX_VIDEO_SIZE: 500 * 1024 * 1024,
  /** Maximum audio file size for transcription (100MB in bytes) */
  MAX_AUDIO_SIZE: 100 * 1024 * 1024
} as const;

export const ACCEPTED_FILE_TYPES = {
  /** Accepted image MIME types for reference images */
  IMAGES: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ] as const,
  /** Accepted video MIME types for uploads */
  VIDEOS: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ] as const,
  /** Accepted audio MIME types for transcription */
  AUDIO: [
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm'
  ] as const
} as const;

// =============================================================================
// VIDEO PROCESSING
// =============================================================================

export const CLIP_CONSTRAINTS = {
  /** Minimum clip duration in milliseconds (30 seconds) */
  MIN_DURATION_MS: 30_000,
  /** Maximum clip duration in milliseconds (45 seconds) */
  MAX_DURATION_MS: 45_000,
  /** Default number of clips to generate */
  DEFAULT_COUNT: 3,
  /** Minimum clips based on duration */
  MIN_COUNT: 1,
  /** Maximum clips based on duration */
  MAX_COUNT: 10
} as const;

export const VIDEO_PRESETS = {
  /** Vertical video for TikTok, Instagram Reels, YouTube Shorts */
  VERTICAL: {
    name: '9:16 Vertical',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16'
  },
  /** Square video for Instagram Feed */
  SQUARE: {
    name: '1:1 Square',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1'
  },
  /** Landscape video for YouTube, LinkedIn */
  LANDSCAPE: {
    name: '16:9 Landscape',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9'
  }
} as const;

export const CAPTION_DEFAULTS = {
  /** Default font size for captions */
  FONT_SIZE: 24,
  /** Default font family for captions */
  FONT_FAMILY: 'Inter',
  /** Default caption position (bottom of video) */
  POSITION: 'bottom',
  /** Default caption color */
  COLOR: '#FFFFFF',
  /** Default caption background color */
  BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.7)',
  /** Default caption padding */
  PADDING: 10
} as const;

// =============================================================================
// AI GENERATION
// =============================================================================

export const OPENAI_DEFAULTS = {
  /** Default model for text generation */
  TEXT_MODEL: 'gpt-4',
  /** Default model for fast/cheap operations */
  FAST_MODEL: 'gpt-3.5-turbo',
  /** Default temperature for creative tasks */
  TEMPERATURE: 0.7,
  /** Default max tokens for responses */
  MAX_TOKENS: 2000,
  /** Timeout for AI requests (30 seconds) */
  TIMEOUT_MS: 30_000
} as const;

export const IMAGEN_DEFAULTS = {
  /** Default model for image generation */
  MODEL: 'imagen-4.0-generate-1',
  /** Default aspect ratio */
  ASPECT_RATIO: '1:1',
  /** Default quality setting */
  QUALITY: 'standard',
  /** Default number of images to generate */
  COUNT: 1,
  /** Maximum prompt length */
  MAX_PROMPT_LENGTH: 2000,
  /** Maximum negative prompt length */
  MAX_NEGATIVE_PROMPT_LENGTH: 500
} as const;

export const VEO_DEFAULTS = {
  /** Default model for video generation */
  MODEL: 'veo-3.1',
  /** Default video duration in seconds */
  DURATION_SEC: 6,
  /** Minimum duration in seconds */
  MIN_DURATION_SEC: 6,
  /** Maximum duration in seconds */
  MAX_DURATION_SEC: 30,
  /** Default aspect ratio */
  ASPECT_RATIO: '9:16',
  /** Poll interval for checking generation status (3 seconds) */
  POLL_INTERVAL_MS: 3000,
  /** Maximum polling attempts */
  MAX_POLL_ATTEMPTS: 100,
  /** Overall timeout for generation (5 minutes) */
  TIMEOUT_MS: 5 * 60 * 1000
} as const;

export const HOOKSMITH_DEFAULTS = {
  /** Number of hooks to generate */
  HOOKS_COUNT: 8,
  /** Target script length in seconds */
  SCRIPT_LENGTH_SEC: 120,
  /** Default tone for scripts */
  TONE: 'engaging',
  /** Available tones */
  TONES: ['casual', 'professional', 'engaging', 'humorous', 'educational'] as const
} as const;

// =============================================================================
// AUTHENTICATION
// =============================================================================

export const AUTH_CONFIG = {
  /** Magic link expiry time in seconds (10 minutes) */
  MAGIC_LINK_EXPIRY_SEC: 10 * 60,
  /** Session token expiry (30 days) */
  SESSION_MAX_AGE_SEC: 30 * 24 * 60 * 60,
  /** JWT secret minimum length */
  JWT_SECRET_MIN_LENGTH: 32
} as const;

export const EMAIL_CONFIG = {
  /** Default sender email address */
  FROM_ADDRESS: process.env.EMAIL_FROM || 'ViralSnipAI <no-reply@clippers.dev>',
  /** Reply-to address */
  REPLY_TO: process.env.EMAIL_REPLY_TO || 'support@clippers.dev',
  /** Email subject for magic links */
  MAGIC_LINK_SUBJECT: 'Sign in to ViralSnipAI'
} as const;

// =============================================================================
// SUBSCRIPTION PLANS
// =============================================================================

/**
 * Deprecated source of truth.
 * Keep this aligned for older helpers, but use `@/lib/billing/plans` for all
 * active packaging, pricing, and entitlement decisions.
 */
export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    workspaces: 1,
    brandKits: 1,
    coreUsage: {
      ideas: 5,
      scripts: 3,
      titles: 5,
      thumbnails: 3,
      tts: 0,
    },
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    priceUSD: 9,
    priceINR: 699,
    workspaces: 1,
    brandKits: 1,
    coreUsage: {
      ideas: 50,
      scripts: 30,
      titles: 100,
      thumbnails: 15,
      tts: 10,
    },
  },
  CREATOR: {
    id: 'creator',
    name: 'Creator',
    priceUSD: 18,
    priceINR: 1499,
    workspaces: 1,
    brandKits: 3,
    scheduledPosts: 10,
    coreUsage: {
      ideas: -1,
      scripts: -1,
      titles: -1,
      thumbnails: -1,
      tts: -1,
    },
  },
  STUDIO: {
    id: 'studio',
    name: 'Studio',
    priceUSD: 45,
    priceINR: 3599,
    workspaces: -1, // Unlimited
    brandKits: -1, // Unlimited
    scheduledPosts: -1, // Unlimited
    apiAccess: true,
    webhookAccess: true,
    supportLevel: "priority_support",
    teamSeats: "admin_managed",
    coreUsage: {
      ideas: -1,
      scripts: -1,
      titles: -1,
      thumbnails: -1,
      tts: -1,
    },
  }
} as const;

export const PRICING = {
  /** Discount percentage for yearly billing */
  YEARLY_DISCOUNT_PERCENT: 30,
  /** Free trial duration in days */
  FREE_TRIAL_DAYS: 14
} as const;

// =============================================================================
// API RATE LIMITS
// =============================================================================

export const RATE_LIMITS = {
  /** Rate limit for expensive AI operations (per user per hour) */
  AI_OPERATIONS: {
    requests: 10,
    windowMs: 60 * 60 * 1000 // 1 hour
  },
  /** Rate limit for transcription operations */
  TRANSCRIPTION: {
    requests: 20,
    windowMs: 60 * 60 * 1000 // 1 hour
  },
  /** Rate limit for video exports */
  EXPORTS: {
    requests: 30,
    windowMs: 60 * 60 * 1000 // 1 hour
  },
  /** Rate limit for general API calls */
  GENERAL: {
    requests: 100,
    windowMs: 15 * 60 * 1000 // 15 minutes
  },
  /** Rate limit for authentication attempts */
  AUTH: {
    requests: 5,
    windowMs: 15 * 60 * 1000 // 15 minutes
  }
} as const;

// =============================================================================
// STORAGE
// =============================================================================

export const STORAGE_PATHS = {
  /** Root directory for uploads */
  UPLOADS: './uploads',
  /** Subdirectory for videos */
  VIDEOS: './uploads/videos',
  /** Subdirectory for audio */
  AUDIO: './uploads/audio',
  /** Subdirectory for images */
  IMAGES: './uploads/images',
  /** Subdirectory for exports */
  EXPORTS: './uploads/exports',
  /** Subdirectory for temporary files */
  TEMP: './uploads/temp'
} as const;

export const S3_CONFIG = {
  /** Default region */
  DEFAULT_REGION: 'us-east-1',
  /** Default ACL for uploads */
  DEFAULT_ACL: 'private',
  /** CloudFront URL format */
  CDN_URL_FORMAT: 'https://cdn.viralsnipai.com'
} as const;

// =============================================================================
// APPLICATION
// =============================================================================

export const APP_CONFIG = {
  /** Application name */
  NAME: 'ViralSnipAI',
  /** Application URL */
  URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  /** Support email */
  SUPPORT_EMAIL: 'support@clippers.dev',
  /** Default timezone */
  TIMEZONE: 'UTC',
  /** Items per page for pagination */
  ITEMS_PER_PAGE: 20,
  /** Maximum items per page */
  MAX_ITEMS_PER_PAGE: 100
} as const;

export const TIMEOUTS = {
  /** Default API request timeout (30 seconds) */
  API_REQUEST_MS: 30_000,
  /** Video processing timeout (10 minutes) */
  VIDEO_PROCESSING_MS: 10 * 60 * 1000,
  /** File upload timeout (5 minutes) */
  FILE_UPLOAD_MS: 5 * 60 * 1000,
  /** Database query timeout (10 seconds) */
  DATABASE_QUERY_MS: 10_000
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURES = {
  /** Enable UI V2 */
  UI_V2: process.env.NEXT_PUBLIC_UI_V2_ENABLED === 'true',
  /** Enable transcription UI */
  TRANSCRIBE: process.env.NEXT_PUBLIC_TRANSCRIBE_UI_ENABLED === 'true',
  /** Enable Imagen integration */
  IMAGEN: process.env.NEXT_PUBLIC_IMAGEN_ENABLED === 'true',
  /** Enable Veo integration */
  VEO: process.env.NEXT_PUBLIC_VEO_ENABLED === 'true' || process.env.FORCE_VEO_ENABLED === 'true',
  /** Enable Sora integration */
  SORA: process.env.NEXT_PUBLIC_SORA_ENABLED === 'true',
  /** Enable Voicer (voice cloning) */
  VOICER: process.env.NEXT_PUBLIC_VOICER_ENABLED === 'true'
} as const;

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Processing errors
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  TRANSCRIPTION_ERROR: 'TRANSCRIPTION_ERROR',
  GENERATION_ERROR: 'GENERATION_ERROR',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT'
} as const;

// =============================================================================
// HTTP STATUS CODES
// =============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;
