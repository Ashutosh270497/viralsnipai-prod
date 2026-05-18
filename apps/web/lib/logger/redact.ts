const SENSITIVE_KEY_RE = /(password|token|secret|key|authorization|cookie)/i;
const TEXT_KEY_RE = /(transcript|captionSrt|summary|description|body)/i;
const MAX_SAFE_STRING_LENGTH = 500;
const PREVIEW_LENGTH = 80;

export function sanitizeForLog(input: unknown): unknown {
  return sanitizeValue(input, "");
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (SENSITIVE_KEY_RE.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (TEXT_KEY_RE.test(key)) {
      return { redacted: true, length: value.length };
    }
    if (value.length > MAX_SAFE_STRING_LENGTH) {
      return {
        redacted: true,
        length: value.length,
        preview: value.slice(0, PREVIEW_LENGTH),
      };
    }
    return value;
  }

  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    if (TEXT_KEY_RE.test(key)) {
      return { redacted: true, length: value.length };
    }
    return value.slice(0, 50).map((entry) => sanitizeValue(entry, key));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitizeValue(childValue, childKey);
    }
    return output;
  }

  return String(value);
}
