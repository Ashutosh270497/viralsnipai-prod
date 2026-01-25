/**
 * Error Handling Utilities
 *
 * Provides centralized error handling for API routes and services.
 *
 * @module Error Handler
 */

import { ApiResponseBuilder, ErrorCodes, ErrorStatusCodes } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * Application Error class
 * Extends Error with additional metadata for structured error handling
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a bad request error (400)
   */
  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.BAD_REQUEST, message, 400, details);
  }

  /**
   * Create an unauthorized error (401)
   */
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(ErrorCodes.UNAUTHORIZED, message, 401);
  }

  /**
   * Create a forbidden error (403)
   */
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(ErrorCodes.FORBIDDEN, message, 403);
  }

  /**
   * Create a not found error (404)
   */
  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(ErrorCodes.NOT_FOUND, message, 404);
  }

  /**
   * Create a conflict error (409)
   */
  static conflict(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.CONFLICT, message, 409, details);
  }

  /**
   * Create a validation error (422)
   */
  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 422, details);
  }

  /**
   * Create an internal server error (500)
   */
  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }

  /**
   * Create a database error (500)
   */
  static database(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.DATABASE_ERROR, message, 500, details);
  }

  /**
   * Create a transcription error (500)
   */
  static transcription(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.TRANSCRIPTION_FAILED, message, 500, details);
  }

  /**
   * Create an AI analysis error (500)
   */
  static aiAnalysis(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.AI_ANALYSIS_FAILED, message, 500, details);
  }

  /**
   * Create an export error (500)
   */
  static export(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.EXPORT_FAILED, message, 500, details);
  }
}

/**
 * Handle API errors and convert to standardized Response
 * @param error - Error to handle
 * @returns Next.js Response with standardized error format
 */
export function handleApiError(error: unknown): Response {
  // Handle AppError instances
  if (error instanceof AppError) {
    // Log the error based on severity (4xx = warn, 5xx = error)
    const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
    logger[logLevel]('API error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
    });

    return ApiResponseBuilder.errorResponse(
      error.code,
      error.message,
      error.statusCode,
      error.details
    );
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    logger.error('Unhandled error', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return ApiResponseBuilder.errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message,
      500
    );
  }

  // Handle unknown errors
  logger.error('Unknown error type', { error });
  return ApiResponseBuilder.errorResponse(
    ErrorCodes.INTERNAL_ERROR,
    'An unknown error occurred',
    500
  );
}

/**
 * Async error wrapper for API route handlers
 * Automatically catches and handles errors
 *
 * @param handler - Async route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```typescript
 * export const GET = withErrorHandling(async (req: Request) => {
 *   const data = await someAsyncOperation();
 *   return ApiResponseBuilder.successResponse(data);
 * });
 * ```
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Validation helper - throw error if condition is false
 * @param condition - Condition to assert
 * @param error - Error to throw if condition is false
 */
export function assert(condition: boolean, error: AppError): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Require a value to be non-null/undefined
 * @param value - Value to check
 * @param errorMessage - Error message if value is null/undefined
 * @returns The value (typed as non-nullable)
 */
export function requireNonNull<T>(value: T | null | undefined, errorMessage: string): T {
  if (value === null || value === undefined) {
    throw AppError.badRequest(errorMessage);
  }
  return value;
}
