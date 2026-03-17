import { toast } from "sonner";

export class NetworkError extends Error {
  constructor(message: string = "Network error occurred") {
    super(message);
    this.name = "NetworkError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);

      onRetry?.(attempt + 1, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Handle client-side errors and show appropriate toast messages
 */
export function handleClientError(error: unknown, fallbackMessage: string = "Something went wrong") {
  console.error("Client Error:", error);

  if (error instanceof RateLimitError) {
    toast.error("Rate Limit Exceeded", {
      description: "You've made too many requests. Please try again in a few minutes.",
    });
    return;
  }

  if (error instanceof NetworkError) {
    toast.error("Network Error", {
      description: "Please check your internet connection and try again.",
      action: {
        label: "Retry",
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  // Generic error
  if (error instanceof Error) {
    toast.error("Error", {
      description: error.message || fallbackMessage,
    });
    return;
  }

  // Unknown error type
  toast.error("Error", {
    description: fallbackMessage,
  });
}

/**
 * Wrapper for fetch with automatic retry and error handling
 */
export async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<T> {
  return withRetry(async () => {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError();
        }

        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError();
      }
      throw error;
    }
  }, retryOptions);
}
