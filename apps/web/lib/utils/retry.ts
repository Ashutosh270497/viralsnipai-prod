/**
 * Retry Utility
 *
 * Provides retry logic for handling transient failures in async operations.
 * Useful for API calls, database operations, and external service integrations.
 *
 * @module Retry
 */

import { logger } from '@/lib/logger';

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry (default: 1000)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries (default: 10000)
   */
  maxDelay?: number;

  /**
   * Backoff multiplier for exponential backoff (default: 2)
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if error should be retried
   * Return true to retry, false to fail immediately
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute async function with retry logic and exponential backoff
 *
 * @example
 * ```ts
 * const data = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts,
    initialDelay = DEFAULT_RETRY_OPTIONS.initialDelay,
    maxDelay = DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        logger.warn('Error is not retryable, failing immediately', {
          error: lastError.message,
          attempt,
        });
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt >= maxAttempts) {
        logger.error('Max retry attempts reached', {
          error: lastError.message,
          attempts: attempt,
        });
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      logger.info('Retrying after error', {
        error: lastError.message,
        attempt,
        maxAttempts,
        delayMs: delay,
      });

      // Call retry callback if provided
      onRetry?.(lastError, attempt, delay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // TypeScript satisfaction - this should never be reached
  throw lastError!;
}

/**
 * Default shouldRetry implementation
 * Retries on network errors and 5xx server errors
 */
function defaultShouldRetry(error: Error, attempt: number): boolean {
  // Don't retry client errors (4xx)
  if (error.message.includes('400') || error.message.includes('401') ||
      error.message.includes('403') || error.message.includes('404')) {
    return false;
  }

  // Retry network errors
  if (error.message.includes('NetworkError') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('ECONNREFUSED')) {
    return true;
  }

  // Retry server errors (5xx)
  if (error.message.includes('500') || error.message.includes('502') ||
      error.message.includes('503') || error.message.includes('504')) {
    return true;
  }

  // Retry timeout errors
  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    return true;
  }

  // Don't retry other errors by default
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper specifically for fetch API calls
 *
 * @example
 * ```ts
 * const response = await retryFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ foo: 'bar' })
 * });
 * ```
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, init);

      // Throw on HTTP errors to trigger retry
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    {
      ...retryOptions,
      shouldRetry: (error, attempt) => {
        // Custom retry logic for fetch
        const status = parseInt(error.message.match(/HTTP (\d+)/)?.[1] || '0');

        // Don't retry client errors (4xx)
        if (status >= 400 && status < 500) {
          return false;
        }

        // Retry server errors (5xx) and network errors
        if (status >= 500 || error.message.includes('Failed to fetch')) {
          return true;
        }

        // Use default retry logic
        return retryOptions?.shouldRetry?.(error, attempt) ?? defaultShouldRetry(error, attempt);
      },
    }
  );
}

/**
 * Create a retryable version of an async function
 *
 * @example
 * ```ts
 * const fetchDataWithRetry = retryable(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxAttempts: 3 }
 * );
 *
 * const data = await fetchDataWithRetry();
 * ```
 */
export function retryable<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options?: RetryOptions
): (...args: Args) => Promise<T> {
  return (...args: Args) => retry(() => fn(...args), options);
}
