export type SnipRadarApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPGRADE_REQUIRED"
  | "USAGE_LIMIT_REACHED"
  | "REAUTH_REQUIRED"
  | "UPSTREAM_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type SnipRadarErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  reauthRequired?: boolean;
  retryable?: boolean;
  details?: unknown;
};

export class SnipRadarApiError extends Error {
  status: number;
  code: SnipRadarApiErrorCode | string;
  reauthRequired: boolean;
  retryable: boolean;
  details?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    reauthRequired?: boolean;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "SnipRadarApiError";
    this.status = params.status;
    this.code = params.code ?? "INTERNAL_ERROR";
    this.reauthRequired = Boolean(params.reauthRequired);
    this.retryable = Boolean(params.retryable);
    this.details = params.details;
  }
}

function defaultCodeForStatus(status: number): SnipRadarApiErrorCode {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "UPSTREAM_ERROR";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "INTERNAL_ERROR";
}

export function toSnipRadarApiError(
  error: unknown,
  fallbackMessage = "Request failed"
): SnipRadarApiError {
  if (error instanceof SnipRadarApiError) return error;
  if (error instanceof Error) {
    return new SnipRadarApiError({
      message: error.message || fallbackMessage,
      status: 500,
      code: "INTERNAL_ERROR",
      retryable: true,
    });
  }
  return new SnipRadarApiError({
    message: fallbackMessage,
    status: 500,
    code: "INTERNAL_ERROR",
    retryable: true,
  });
}

async function safeParsePayload(response: Response): Promise<SnipRadarErrorPayload> {
  try {
    const parsed = (await response.json()) as SnipRadarErrorPayload;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

export async function parseSnipRadarApiError(
  response: Response,
  fallbackMessage = "Request failed"
): Promise<SnipRadarApiError> {
  const payload = await safeParsePayload(response);
  const message =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.message === "string"
        ? payload.message
        : fallbackMessage;
  const code =
    typeof payload.code === "string" ? payload.code : defaultCodeForStatus(response.status);
  const reauthRequired =
    typeof payload.reauthRequired === "boolean"
      ? payload.reauthRequired
      : code === "REAUTH_REQUIRED";
  const retryable =
    typeof payload.retryable === "boolean"
      ? payload.retryable
      : response.status >= 500 || response.status === 429;

  return new SnipRadarApiError({
    message,
    status: response.status,
    code,
    reauthRequired,
    retryable,
    details: payload.details,
  });
}

export type SnipRadarRecoveryState = {
  kind:
    | "reauth"
    | "upgrade"
    | "limit_reached"
    | "rate_limited"
    | "upstream"
    | "service_unavailable"
    | "unauthorized"
    | "unknown";
  title: string;
  message: string;
  actionLabel: string;
  retryable: boolean;
  code: string;
};

export function deriveSnipRadarRecoveryState(
  input: unknown,
  fallbackMessage = "Something went wrong while loading SnipRadar."
): SnipRadarRecoveryState | null {
  if (!input) return null;
  const error = toSnipRadarApiError(input, fallbackMessage);

  if (error.reauthRequired || error.code === "REAUTH_REQUIRED") {
    return {
      kind: "reauth",
      title: "Reconnect X account required",
      message:
        error.message || "Live X metrics and posting are paused until account re-authorization.",
      actionLabel: "Reconnect X",
      retryable: false,
      code: String(error.code),
    };
  }

  if (error.code === "UPGRADE_REQUIRED") {
    return {
      kind: "upgrade",
      title: "Upgrade required",
      message: error.message || "Your current plan does not include this feature.",
      actionLabel: "Upgrade",
      retryable: false,
      code: String(error.code),
    };
  }

  if (error.code === "USAGE_LIMIT_REACHED") {
    return {
      kind: "limit_reached",
      title: "Plan limit reached",
      message: error.message || "This plan limit has been reached.",
      actionLabel: "Upgrade",
      retryable: false,
      code: String(error.code),
    };
  }

  if (error.code === "RATE_LIMITED" || error.status === 429) {
    return {
      kind: "rate_limited",
      title: "X API rate limit reached",
      message: error.message || "Please retry shortly.",
      actionLabel: "Retry",
      retryable: true,
      code: String(error.code),
    };
  }

  if (error.code === "UPSTREAM_ERROR" || error.status === 502) {
    return {
      kind: "upstream",
      title: "Upstream X API issue",
      message: error.message || "X API is temporarily unavailable.",
      actionLabel: "Retry",
      retryable: true,
      code: String(error.code),
    };
  }

  if (error.code === "SERVICE_UNAVAILABLE" || error.status === 503) {
    return {
      kind: "service_unavailable",
      title: "SnipRadar service temporarily unavailable",
      message: error.message || "Please retry in a moment.",
      actionLabel: "Retry",
      retryable: true,
      code: String(error.code),
    };
  }

  if (error.code === "UNAUTHORIZED" || error.status === 401) {
    return {
      kind: "unauthorized",
      title: "Session expired",
      message: error.message || "Please sign in again.",
      actionLabel: "Refresh",
      retryable: true,
      code: String(error.code),
    };
  }

  return {
    kind: "unknown",
    title: "SnipRadar request failed",
    message: error.message || fallbackMessage,
    actionLabel: error.retryable ? "Retry" : "Refresh",
    retryable: error.retryable,
    code: String(error.code),
  };
}
