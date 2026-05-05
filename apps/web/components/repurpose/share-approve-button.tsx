"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ShareApproveButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "approved" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function approve() {
    setStatus("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/repurpose/share-links/${token}/approve`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Approval failed");
      }
      setStatus("approved");
      setMessage("Clip approved. The project owner will see this in their review queue.");
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Approval failed");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={approve}
        disabled={status === "saving" || status === "approved"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {status === "approved" ? "Approved" : "Approve clip"}
      </button>
      {message ? (
        <p className={status === "failed" ? "text-xs text-red-200" : "text-xs text-emerald-200/80"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
