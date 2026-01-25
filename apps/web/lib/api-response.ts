/**
 * Standardized API response utilities
 *
 * Provides consistent response formats across all API routes.
 * Ensures type safety and consistent error handling.
 */

import { NextResponse } from 'next/server';
import { ERROR_CODES, HTTP_STATUS } from './constants';
import { logger } from './logger';
import { ZodError } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Successful API response structure
 */
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Error API response structure
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    field?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// =============================================================================
// SUCCESS RESPONSES
// =============================================================================

/**
 * Create a successful API response
 *
 * @param data - The response data
 * @param options - Optional metadata
 * @returns NextResponse with success structure
 *
 * @example
 * ```ts
 * return apiSuccess({ user: { id: '123', name: 'John' } });
 * ```
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    requestId?: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  }
): NextResponse<ApiSuccess<T>> {
  const response: ApiSuccess<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
      ...(options?.pagination && {
        pagination: {
          ...options.pagination,
          totalPages: Math.ceil(options.pagination.total / options.pagination.pageSize)
        }
      })
    }
  };

  return NextResponse.json(response, {
    status: options?.status || HTTP_STATUS.OK
  });
}

/**
 * Create a successful response for resource creation
 */
export function apiCreated<T>(
  data: T,
  options?: {
    requestId?: string;
    location?: string;
  }
): NextResponse<ApiSuccess<T>> {
  const response = apiSuccess(data, {
    status: HTTP_STATUS.CREATED,
    requestId: options?.requestId
  });

  if (options?.location) {
    response.headers.set('Location', options.location);
  }

  return response;
}

/**
 * Create a successful response with no content
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, {
    status: HTTP_STATUS.NO_CONTENT
  });
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

/**
 * Create an error API response
 *
 * @param code - Error code from ERROR_CODES
 * @param message - Human-readable error message
 * @param options - Additional error details
 * @returns NextResponse with error structure
 *
 * @example
 * ```ts
 * return apiError(
 *   ERROR_CODES.NOT_FOUND,
 *   'Project not found',
 *   { status: HTTP_STATUS.NOT_FOUND }
 * );
 * ```
 */
export function apiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    details?: unknown;
    field?: string;
    requestId?: string;
    logError?: boolean;
  }
): NextResponse<ApiError> {
  const response: ApiError = {
    success: false,
    error: {
      code,
      message,
      details: options?.details,
      field: options?.field
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: options?.requestId
    }
  };

  // Log error if requested (default: true for server errors)
  const shouldLog = options?.logError ?? (options?.status ?? HTTP_STATUS.INTERNAL_SERVER_ERROR) >= 500;
  if (shouldLog) {
    logger.error(message, {
      code,
      status: options?.status,
      details: options?.details,
      field: options?.field
    });
  }

  return NextResponse.json(response, {
    status: options?.status || HTTP_STATUS.BAD_REQUEST
  });
}

// =============================================================================
// COMMON ERROR RESPONSES
// =============================================================================

/**
 * 400 Bad Request - Invalid input
 */
export function apiBadRequest(
  message: string = 'Invalid request',
  details?: unknown
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.INVALID_INPUT, message, {
    status: HTTP_STATUS.BAD_REQUEST,
    details,
    logError: false
  });
}

/**
 * 401 Unauthorized - Authentication required
 */
export function apiUnauthorized(
  message: string = 'Authentication required'
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.UNAUTHORIZED, message, {
    status: HTTP_STATUS.UNAUTHORIZED,
    logError: false
  });
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export function apiForbidden(
  message: string = 'Insufficient permissions'
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.FORBIDDEN, message, {
    status: HTTP_STATUS.FORBIDDEN,
    logError: false
  });
}

/**
 * 404 Not Found - Resource not found
 */
export function apiNotFound(
  resource: string = 'Resource'
): NextResponse<ApiError> {
  return apiError(
    ERROR_CODES.NOT_FOUND,
    `${resource} not found`,
    {
      status: HTTP_STATUS.NOT_FOUND,
      logError: false
    }
  );
}

/**
 * 409 Conflict - Resource already exists
 */
export function apiConflict(
  message: string = 'Resource already exists'
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.ALREADY_EXISTS, message, {
    status: HTTP_STATUS.CONFLICT,
    logError: false
  });
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export function apiValidationError(
  message: string = 'Validation failed',
  details?: unknown
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.VALIDATION_ERROR, message, {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    details,
    logError: false
  });
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export function apiRateLimitExceeded(
  retryAfter?: number
): NextResponse<ApiError> {
  const response = apiError(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded. Please try again later.',
    {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      logError: false
    }
  );

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * 500 Internal Server Error - Generic server error
 */
export function apiInternalError(
  message: string = 'An unexpected error occurred',
  error?: unknown
): NextResponse<ApiError> {
  return apiError(ERROR_CODES.INTERNAL_ERROR, message, {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details: process.env.NODE_ENV === 'development' ? error : undefined,
    logError: true
  });
}

/**
 * 503 Service Unavailable - External service error
 */
export function apiServiceUnavailable(
  service: string = 'Service'
): NextResponse<ApiError> {
  return apiError(
    ERROR_CODES.SERVICE_UNAVAILABLE,
    `${service} is temporarily unavailable`,
    {
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      logError: true
    }
  );
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Handle Zod validation errors and convert to API error response
 */
export function handleZodError(error: ZodError): NextResponse<ApiError> {
  const firstError = error.errors[0];
  const field = firstError?.path.join('.');
  const message = firstError?.message || 'Validation failed';

  return apiError(ERROR_CODES.VALIDATION_ERROR, message, {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    field,
    details: error.errors.map((err) => ({
      path: err.path,
      message: err.message,
      code: err.code
    })),
    logError: false
  });
}

/**
 * Handle Prisma errors and convert to API error response
 */
export function handlePrismaError(error: any): NextResponse<ApiError> {
  // P2002: Unique constraint failed
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field';
    return apiError(
      ERROR_CODES.ALREADY_EXISTS,
      `A record with this ${field} already exists`,
      {
        status: HTTP_STATUS.CONFLICT,
        field,
        logError: false
      }
    );
  }

  // P2025: Record not found
  if (error.code === 'P2025') {
    return apiNotFound();
  }

  // P2003: Foreign key constraint failed
  if (error.code === 'P2003') {
    return apiError(
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid reference to related resource',
      {
        status: HTTP_STATUS.BAD_REQUEST,
        logError: false
      }
    );
  }

  // Generic database error
  return apiInternalError('Database error occurred', error);
}

/**
 * Generic error handler that tries to identify error type
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  // Zod validation error
  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  // Prisma error
  if (error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string') {
    return handlePrismaError(error);
  }

  // Standard Error object
  if (error instanceof Error) {
    return apiInternalError(error.message, error);
  }

  // Unknown error
  return apiInternalError('An unexpected error occurred', error);
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiError {
  return response.success === false;
}
