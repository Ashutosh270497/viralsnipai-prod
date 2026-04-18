/**
 * X OAuth token encryption at rest.
 *
 * Access tokens and refresh tokens are stored encrypted in the database using
 * AES-256-GCM (the same cipher used for webhook secrets). This module provides
 * thin, X-token-specific wrappers with graceful fallback for:
 *   - "bearer-only" sentinel values (never encrypted — they are not real tokens)
 *   - Legacy plaintext tokens that existed before encryption was introduced
 *     (detected by the absence of the "v1:" version prefix)
 *
 * Migration: run `scripts/encrypt-x-tokens.ts` to encrypt all existing
 * plaintext tokens in the database in one pass.
 */

import {
  encryptSnipRadarSecret,
  decryptSnipRadarSecret,
} from "@/lib/snipradar/public-api";

const ENCRYPTED_PREFIX = "v1:";

/** Sentinel value for accounts connected via Bearer token only (no OAuth). */
const BEARER_ONLY = "bearer-only";

/**
 * Encrypt an X OAuth token before writing it to the database.
 * "bearer-only" passes through unchanged — it is a sentinel, not a real token.
 */
export function encryptXToken(value: string): string {
  if (value === BEARER_ONLY) return value;
  return encryptSnipRadarSecret(value);
}

/**
 * Decrypt an X OAuth token read from the database.
 *
 * Graceful fallback rules (applied in order):
 *  1. "bearer-only" → returned as-is (sentinel value)
 *  2. Does not start with "v1:" → returned as-is (legacy plaintext, not yet migrated)
 *  3. Starts with "v1:" → decrypted with AES-256-GCM
 */
export function decryptXToken(value: string): string {
  if (value === BEARER_ONLY) return value;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value; // legacy plaintext
  return decryptSnipRadarSecret(value);
}

/**
 * Decrypt both token fields of an XAccount-like object in one call.
 * Returns a shallow copy with the plaintext tokens — the original is unchanged.
 */
export function decryptXAccountTokens<
  T extends { accessToken: string; refreshToken: string | null }
>(account: T): T {
  return {
    ...account,
    accessToken: decryptXToken(account.accessToken),
    refreshToken: account.refreshToken ? decryptXToken(account.refreshToken) : null,
  };
}
