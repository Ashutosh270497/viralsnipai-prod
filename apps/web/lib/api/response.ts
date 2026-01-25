/**
 * Standardized API Response Builder
 *
 * Provides consistent response format across all API endpoints.
 * Enables better client-side error handling and debugging.
 *
 * @module API Response
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Builder class for constructing standardized API responses
 */
export class ApiResponseBuilder {
  /**
   * Build a successful response payload (internal use)
   * @param data - Response data
   * @param meta - Optional metadata
   * @returns Standardized success response
   */
  private static buildSuccessPayload<T>(data: T, meta?: Partial<ApiResponse['meta']>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        ...meta,
      },
    };
  }

  /**
   * Build an error response payload (internal use)
   * @param code - Error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
   * @param message - Human-readable error message
   * @param details - Optional error details
   * @returns Standardized error response
   */
  private static buildErrorPayload(code: string, message: string, details?: unknown): ApiResponse {
    return {
      success: false,
      error: { code, message, details },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    };
  }

  /**
   * Build a paginated response
   * @param data - Array of items
   * @param page - Current page number (1-indexed)
   * @param pageSize - Number of items per page
   * @param total - Total number of items
   * @returns Standardized paginated response
   */
  private static paginated<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  /**
   * Build a Next.js Response object with success data
   * @param data - Response data
   * @param status - HTTP status code (default: 200)
   * @returns Next.js Response object
   */
  static successResponse<T>(data: T, status: number = 200): Response {
    return Response.json(this.buildSuccessPayload(data), { status });
  }

  /**
   * Build a Next.js Response object with error
   * @param code - Error code
   * @param message - Error message
   * @param status - HTTP status code (default: 500)
   * @param details - Optional error details
   * @returns Next.js Response object
   */
  static errorResponse(
    code: string,
    message: string,
    status: number = 500,
    details?: unknown
  ): Response {
    return Response.json(this.buildErrorPayload(code, message, details), { status });
  }

  /**
   * Build a Next.js Response object with paginated data
   * @param data - Array of items
   * @param page - Current page
   * @param pageSize - Items per page
   * @param total - Total items
   * @param status - HTTP status code (default: 200)
   * @returns Next.js Response object
   */
  static paginatedResponse<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    status: number = 200
  ): Response {
    return Response.json(this.paginated(data, page, pageSize, total), { status });
  }

  // ==================== Convenience Response Methods ====================

  /**
   * Build a successful response with data and optional message
   * Overload: accepts either (data, message) or (data, meta)
   * @param data - Response data
   * @param messageOrMeta - Optional success message (string) or metadata (object)
   * @returns Next.js Response object with 200 status
   */
  static success<T>(data: T, messageOrMeta?: string | Partial<ApiResponse['meta']>): Response {
    let responsePayload: ApiResponse<T>;

    if (typeof messageOrMeta === 'string') {
      // Message provided - create response with message
      responsePayload = {
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      };
      (responsePayload as any).message = messageOrMeta;
    } else {
      // Metadata provided - use buildSuccessPayload method
      responsePayload = this.buildSuccessPayload(data, messageOrMeta);
    }

    return Response.json(responsePayload, { status: 200 });
  }

  /**
   * Build a 400 Bad Request response
   * @param message - Error message
   * @param details - Optional error details
   * @returns Next.js Response object with 400 status
   */
  static badRequest(message: string, details?: unknown): Response {
    return this.errorResponse(ErrorCodes.BAD_REQUEST, message, 400, details);
  }

  /**
   * Build a 401 Unauthorized response
   * @param message - Error message (default: 'Unauthorized')
   * @param details - Optional error details
   * @returns Next.js Response object with 401 status
   */
  static unauthorized(message: string = 'Unauthorized', details?: unknown): Response {
    return this.errorResponse(ErrorCodes.UNAUTHORIZED, message, 401, details);
  }

  /**
   * Build a 403 Forbidden response
   * @param message - Error message (default: 'Forbidden')
   * @param details - Optional error details
   * @returns Next.js Response object with 403 status
   */
  static forbidden(message: string = 'Forbidden', details?: unknown): Response {
    return this.errorResponse(ErrorCodes.FORBIDDEN, message, 403, details);
  }

  /**
   * Build a 404 Not Found response
   * @param message - Error message (default: 'Resource not found')
   * @param details - Optional error details
   * @returns Next.js Response object with 404 status
   */
  static notFound(message: string = 'Resource not found', details?: unknown): Response {
    return this.errorResponse(ErrorCodes.NOT_FOUND, message, 404, details);
  }

  /**
   * Build a 409 Conflict response
   * @param message - Error message
   * @param details - Optional error details
   * @returns Next.js Response object with 409 status
   */
  static conflict(message: string, details?: unknown): Response {
    return this.errorResponse(ErrorCodes.CONFLICT, message, 409, details);
  }

  /**
   * Build a 422 Validation Error response
   * @param message - Error message
   * @param details - Validation error details
   * @returns Next.js Response object with 422 status
   */
  static validationError(message: string, details?: unknown): Response {
    return this.errorResponse(ErrorCodes.VALIDATION_ERROR, message, 422, details);
  }

  /**
   * Build a 500 Internal Server Error response
   * @param message - Error message (default: 'Internal server error')
   * @param details - Optional error details
   * @returns Next.js Response object with 500 status
   */
  static internalError(message: string = 'Internal server error', details?: unknown): Response {
    return this.errorResponse(ErrorCodes.INTERNAL_ERROR, message, 500, details);
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client Errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Application-Specific Errors
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  AI_ANALYSIS_FAILED: 'AI_ANALYSIS_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  CLIP_GENERATION_FAILED: 'CLIP_GENERATION_FAILED',
} as const;

/**
 * HTTP status code mapping for common errors
 */
export const ErrorStatusCodes: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
  TRANSCRIPTION_FAILED: 500,
  AI_ANALYSIS_FAILED: 500,
  EXPORT_FAILED: 500,
  FILE_UPLOAD_FAILED: 500,
  CLIP_GENERATION_FAILED: 500,
};
