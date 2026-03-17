import { NextResponse } from "next/server";

type SnipRadarErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "REAUTH_REQUIRED"
  | "UPSTREAM_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

function defaultCodeForStatus(status: number): SnipRadarErrorCode {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "UPSTREAM_ERROR";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "INTERNAL_ERROR";
}

export function withSnipRadarErrorContract(
  body: unknown,
  status: number
): Record<string, unknown> {
  const source =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const message =
    typeof source.error === "string"
      ? source.error
      : typeof source.message === "string"
        ? source.message
        : "Request failed";

  const code =
    typeof source.code === "string"
      ? source.code
      : defaultCodeForStatus(status);

  const reauthRequired =
    typeof source.reauthRequired === "boolean"
      ? source.reauthRequired
      : code === "REAUTH_REQUIRED";

  const retryable =
    typeof source.retryable === "boolean"
      ? source.retryable
      : status >= 500 || status === 429;

  return {
    ...source,
    success: false,
    error: message,
    code,
    reauthRequired,
    retryable,
  };
}

export function snipradarErrorResponse(
  message: string,
  status: number,
  options?: {
    code?: string;
    reauthRequired?: boolean;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }
): NextResponse {
  return NextResponse.json(
    withSnipRadarErrorContract(
      {
        error: message,
        ...(options?.code ? { code: options.code } : {}),
        ...(typeof options?.reauthRequired === "boolean"
          ? { reauthRequired: options.reauthRequired }
          : {}),
        ...(typeof options?.retryable === "boolean"
          ? { retryable: options.retryable }
          : {}),
        ...(options?.details ? { details: options.details } : {}),
      },
      status
    ),
    { status }
  );
}

