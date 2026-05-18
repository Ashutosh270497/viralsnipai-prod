export function sanitizeInternalRedirect(
  input: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  if (input.includes("\\\\")) return fallback;

  try {
    const url = new URL(input, "http://internal.local");
    if (url.origin !== "http://internal.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
