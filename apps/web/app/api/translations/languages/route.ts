export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * Supported languages for translation
 * These align with the TranslationService language mappings
 */
const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    region: 'Global',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    region: 'India',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    region: 'India',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    region: 'India',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    region: 'India',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    region: 'India',
  },
];

/**
 * GET /api/translations/languages
 *
 * Returns list of supported languages for translation.
 * Public endpoint (authentication not required for language list).
 *
 * @returns {array} List of supported language objects with code, name, and native name
 */
export const GET = withErrorHandling(async (request: Request) => {
  logger.info('Languages list API called');

  // Return supported languages
  return ApiResponseBuilder.success(
    {
      languages: SUPPORTED_LANGUAGES,
      count: SUPPORTED_LANGUAGES.length,
    },
    'Supported languages retrieved'
  );
});
