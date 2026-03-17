"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ color: "#dc2626" }}>Something went wrong</h2>
        <p style={{ color: "#666" }}>{error.message || "An unexpected error occurred"}</p>
        {error.digest && <p style={{ color: "#999", fontSize: "0.875rem" }}>Error ID: {error.digest}</p>}
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <p style={{ marginTop: "1rem" }}>
          <a href="/signin" style={{ color: "#2563eb" }}>Back to Sign In</a>
        </p>
      </body>
    </html>
  );
}
