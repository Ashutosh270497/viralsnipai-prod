import { getSupportEmail } from "@/lib/support";

export const HTTP_TIMEOUTS = {
  normal: 20_000,
  prompt: 120_000,
  generation: 10 * 60_000,
  upload: null,
} as const;

export type ApiOperation = keyof typeof HTTP_TIMEOUTS;

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiFetchOptions extends RequestInit {
  operation?: ApiOperation;
  timeoutMs?: number | null;
  retries?: number;
  retryDelayMs?: number;
}

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    operation = "normal",
    timeoutMs = HTTP_TIMEOUTS[operation],
    retries = 0,
    retryDelayMs = 500,
    ...init
  } = options;

  const method = (init.method || "GET").toUpperCase();
  const safeRetries = method === "GET" ? retries : 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
    const controller = timeoutMs === null ? null : new AbortController();
    const timeout =
      controller && timeoutMs
        ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
        : undefined;

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller?.signal ?? init.signal,
      });
      if (timeout) globalThis.clearTimeout(timeout);

      const payload = await parseResponse(response);
      if (!response.ok) {
        throw toHttpError(response.status, payload);
      }
      return payload as T;
    } catch (error) {
      if (timeout) globalThis.clearTimeout(timeout);
      lastError = normalizeFetchError(error);
      if (attempt < safeRetries) {
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw normalizeFetchError(lastError);
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text().catch(() => "");
  return text ? { message: text } : {};
}

function toHttpError(status: number, payload: any) {
  const message =
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    friendlyStatusMessage(status);
  return new HttpError(String(message), status, payload?.error?.code, payload?.error?.details);
}

function normalizeFetchError(error: unknown) {
  if (error instanceof HttpError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new HttpError(
      "This is taking longer than usual. Please try again.",
      408,
      "REQUEST_TIMEOUT",
    );
  }
  if (error instanceof Error) {
    return new HttpError(error.message || "Network request failed.", 0, "NETWORK_ERROR");
  }
  return new HttpError("Network request failed.", 0, "NETWORK_ERROR");
}

export function getFriendlyHttpErrorMessage(error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 401) return "Your session expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to do that.";
    if (error.status === 413) return "That file is too large for the current upload limit.";
    if (error.status === 429) return "Too many requests. Please wait a moment and try again.";
    if (error.status >= 500) {
      return `Something went wrong on our side. Please try again. If this keeps happening, contact ${getSupportEmail()}.`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function friendlyStatusMessage(status: number) {
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 413) return "That file is too large for the current upload limit.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) {
    return `Something went wrong on our side. Please try again. If this keeps happening, contact ${getSupportEmail()}.`;
  }
  return "Request failed. Please try again.";
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
