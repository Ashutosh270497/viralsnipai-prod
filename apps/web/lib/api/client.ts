/**
 * API Client
 *
 * Centralized HTTP client for making API requests.
 * Provides consistent error handling and response formatting.
 *
 * @module api-client
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  /**
   * Make an HTTP request
   *
   * @param url - The API endpoint URL
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws {ApiError} When the request fails
   */
  async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    // Handle non-OK responses
    if (!response.ok) {
      let errorData: unknown;
      let errorMessage = response.statusText;

      try {
        errorData = await response.json();
        if (errorData && typeof errorData === 'object' && 'message' in errorData) {
          errorMessage = String(errorData.message);
        } else if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          errorMessage = String(errorData.error);
        }
      } catch {
        // Failed to parse error response, use status text
      }

      throw new ApiError(response.status, errorMessage, errorData);
    }

    // Parse successful response
    return response.json();
  }

  /**
   * Make a GET request
   */
  get<T>(url: string, options?: Omit<RequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  post<T>(url: string, data?: unknown, options?: Omit<RequestInit, 'method' | 'body'>) {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make a PUT request
   */
  put<T>(url: string, data?: unknown, options?: Omit<RequestInit, 'method' | 'body'>) {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make a PATCH request
   */
  patch<T>(url: string, data?: unknown, options?: Omit<RequestInit, 'method' | 'body'>) {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make a DELETE request
   */
  delete<T>(url: string, options?: Omit<RequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

/**
 * Singleton API client instance
 */
export const apiClient = new ApiClient();
