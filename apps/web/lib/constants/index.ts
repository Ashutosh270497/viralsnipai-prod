/**
 * Application Constants
 *
 * Centralized configuration and constants to avoid magic numbers
 * scattered throughout the codebase.
 *
 * @module Constants
 */

/**
 * API Configuration
 */
export const API = {
  /** Default timeout for API calls in milliseconds */
  DEFAULT_TIMEOUT: 30000,

  /** Retry configuration */
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10000,
    BACKOFF_MULTIPLIER: 2,
  },
} as const;

/**
 * Search Configuration
 */
export const SEARCH = {
  /** Default number of search results to return */
  DEFAULT_LIMIT: 10,

  /** Maximum number of search results */
  MAX_LIMIT: 50,

  /** Debounce delay for search input in milliseconds */
  DEBOUNCE_DELAY: 500,

  /** Minimum search query length */
  MIN_QUERY_LENGTH: 2,

  /** Relevance score thresholds */
  RELEVANCE_THRESHOLDS: {
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40,
  },

  /** Scoring weights (must sum to 100) */
  SCORING_WEIGHTS: {
    KEYWORDS: 40,
    EMOTIONS: 20,
    ACTIONS: 20,
    VIRALITY: 10,
    DURATION: 10,
  },
} as const;

/**
 * Chapter Segmentation Configuration
 */
export const CHAPTERS = {
  /** Maximum number of chapters */
  MAX_CHAPTERS: 50,

  /** Minimum chapter duration in seconds */
  MIN_DURATION_SEC: 10,

  /** Optimal chapter count by video duration */
  OPTIMAL_COUNT: {
    /** Duration < 5 minutes */
    VERY_SHORT: { MAX_DURATION: 5 * 60, COUNT: 1 },
    /** Duration 5-10 minutes */
    SHORT: { MAX_DURATION: 10 * 60, COUNT: 3 },
    /** Duration 10-20 minutes */
    MEDIUM: { MAX_DURATION: 20 * 60, COUNT: 5 },
    /** Duration 20-40 minutes */
    LONG: { MAX_DURATION: 40 * 60, COUNT: 7 },
    /** Duration > 40 minutes */
    VERY_LONG: { MAX_DURATION: Infinity, COUNT: 10 },
  },
} as const;

/**
 * Composite Clip Configuration
 */
export const COMPOSITE = {
  /** Maximum number of segments in a composite clip */
  MAX_SEGMENTS: 50,

  /** Minimum number of segments */
  MIN_SEGMENTS: 1,

  /** Maximum duration in seconds */
  MAX_DURATION_SEC: 600, // 10 minutes

  /** Minimum duration in seconds */
  MIN_DURATION_SEC: 1,

  /** File size thresholds in MB */
  FILE_SIZE: {
    WARNING_THRESHOLD: 500,
    MAX_RECOMMENDED: 1000,
  },

  /** Quality multipliers for file size estimation */
  QUALITY_MULTIPLIERS: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 4,
    MAX: 8,
  },

  /** Processing time estimation (seconds per segment) */
  PROCESSING_TIME: {
    BASE_PER_SEGMENT: 30,
    PER_SECOND_OF_VIDEO: 0.1,
  },
} as const;

/**
 * Video Configuration
 */
export const VIDEO = {
  /** Supported output formats */
  FORMATS: ['mp4', 'mov', 'webm'] as const,

  /** Supported quality levels */
  QUALITIES: ['low', 'medium', 'high', 'max'] as const,

  /** Supported presets */
  PRESETS: {
    SHORTS_9X16_1080: 'shorts_9x16_1080',
    SQUARE_1X1_1080: 'square_1x1_1080',
    PORTRAIT_4X5_1080: 'portrait_4x5_1080',
    LANDSCAPE_16X9_1080: 'landscape_16x9_1080',
  } as const,

  /** Transition types */
  TRANSITIONS: ['cut', 'fade', 'crossfade'] as const,

  /** Maximum upload size in bytes (500MB) */
  MAX_UPLOAD_SIZE: 500 * 1024 * 1024,

  /** Supported video extensions */
  SUPPORTED_EXTENSIONS: ['.mp4', '.mov', '.avi', '.mkv', '.webm'] as const,
} as const;

/**
 * AI/ML Configuration
 */
export const AI = {
  /** OpenAI model for search */
  SEARCH_MODEL: 'gpt-4o-mini',

  /** OpenAI model for chapter segmentation */
  CHAPTER_MODEL: 'gpt-4o-mini',

  /** Temperature for query analysis (0.0 - 1.0) */
  QUERY_TEMPERATURE: 0.3,

  /** Temperature for chapter segmentation (0.0 - 1.0) */
  CHAPTER_TEMPERATURE: 0.4,

  /** Virality score thresholds */
  VIRALITY: {
    HIGH: 90,
    MEDIUM: 75,
    LOW: 60,
  },
} as const;

/**
 * UI Configuration
 */
export const UI = {
  /** Debounce delays */
  DEBOUNCE: {
    SEARCH: 500,
    INPUT: 300,
    RESIZE: 150,
  },

  /** Animation durations in milliseconds */
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },

  /** Toast/notification durations */
  TOAST: {
    SHORT: 3000,
    NORMAL: 5000,
    LONG: 8000,
  },

  /** Pagination */
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },

  /** Grid breakpoints (matches Tailwind) */
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  },
} as const;

/**
 * Validation Rules
 */
export const VALIDATION = {
  /** Title length limits */
  TITLE: {
    MIN: 1,
    MAX: 200,
  },

  /** Description length limits */
  DESCRIPTION: {
    MIN: 0,
    MAX: 1000,
  },

  /** Project name length limits */
  PROJECT_NAME: {
    MIN: 1,
    MAX: 100,
  },

  /** Query length limits */
  QUERY: {
    MIN: 1,
    MAX: 500,
  },
} as const;

/**
 * Cache Configuration
 */
export const CACHE = {
  /** Cache TTL in milliseconds */
  TTL: {
    SHORT: 5 * 60 * 1000, // 5 minutes
    MEDIUM: 15 * 60 * 1000, // 15 minutes
    LONG: 60 * 60 * 1000, // 1 hour
  },

  /** Cache keys */
  KEYS: {
    PROJECTS: 'projects',
    CLIPS: 'clips',
    ASSETS: 'assets',
    SEARCH_RESULTS: 'search-results',
    CHAPTERS: 'chapters',
  },
} as const;

/**
 * Storage Paths
 */
export const STORAGE = {
  /** Temporary directory for composite clips */
  TEMP_DIR: '/tmp/composite-clips',

  /** Upload directory */
  UPLOADS_DIR: '/uploads',

  /** Thumbnails directory */
  THUMBNAILS_DIR: '/uploads/thumbnails',

  /** Exports directory */
  EXPORTS_DIR: '/exports',
} as const;

/**
 * Feature Flags
 */
export const FEATURES = {
  /** Enable experimental features */
  EXPERIMENTAL: process.env.NODE_ENV === 'development',

  /** Enable detailed logging */
  VERBOSE_LOGGING: process.env.NODE_ENV === 'development',

  /** Enable performance monitoring */
  PERFORMANCE_MONITORING: true,
} as const;

/**
 * Error Messages
 */
export const ERRORS = {
  NETWORK: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You must be logged in to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An unexpected server error occurred. Please try again later.',
  VALIDATION: 'Please check your input and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
} as const;
