/**
 * CORS helpers for API routes.
 * Use corsHeaders() to add CORS to any route response.
 * Use handleCorsPreflight() in routes that need to handle OPTIONS requests.
 */

import { NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralsnipai.com';

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
}

/**
 * Handle OPTIONS preflight requests.
 * Add this as an export in any route file that serves cross-origin requests.
 *
 * Usage in route.ts:
 *   export { handleCorsPreflight as OPTIONS } from '@/lib/api/cors';
 *
 * Or:
 *   export async function OPTIONS() {
 *     return handleCorsPreflight();
 *   }
 */
export function handleCorsPreflight(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
    },
  });
}
