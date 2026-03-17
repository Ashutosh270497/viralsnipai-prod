"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ThreadTweetRowProps {
  draft: {
    id: string;
    text: string;
    threadOrder: number | null;
    status: string;
    postedTweetId?: string | null;
  };
  xUsername?: string;
  totalTweets: number;
}

/**
 * Stripped-down per-tweet display for use inside ThreadComposer.
 * Shows tweet number, content, char count, and inline edit only.
 * Post/Schedule actions are intentionally absent — they live at
 * the thread level in ThreadComposer, not per-tweet.
 */
export function ThreadTweetRow({ draft, xUsername, totalTweets }: ThreadTweetRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(draft.text);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["snipradar"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-drafts"] });
    },
  });

  const order = draft.threadOrder ?? 1;
  const isLast = order === totalTweets;
  const isPosted = draft.status === "posted";

  return (
    <div className="flex gap-3">
      {/* Thread connector column */}
      <div className="flex flex-col items-center shrink-0 w-6">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono font-semibold",
            isPosted
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {order}
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-border min-h-[20px]" />
        )}
      </div>

      {/* Tweet content */}
      <div className={cn("flex-1", isLast ? "pb-0" : "pb-3")}>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[72px] text-sm"
              maxLength={280}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs",
                  editText.length > 260 ? "text-amber-500" : "text-muted-foreground"
                )}
              >
                {editText.length}/280
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditText(draft.text);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate(editText)}
                  disabled={
                    !editText.trim() ||
                    editText === draft.text ||
                    updateMutation.isPending
                  }
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="group relative rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-7">
              {draft.text}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={cn(
                  "text-[11px]",
                  draft.text.length > 260
                    ? "text-amber-500"
                    : "text-muted-foreground"
                )}
              >
                {draft.text.length}/280
              </span>
              {isPosted && xUsername && draft.postedTweetId && (
                <a
                  href={`https://x.com/${xUsername}/status/${draft.postedTweetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  ✓ Posted
                </a>
              )}
            </div>
            {/* Edit button — appears on hover, hidden when posted */}
            {!isPosted && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="absolute right-2 top-2 hidden rounded p-1 text-muted-foreground transition-colors hover:text-foreground group-hover:block"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {updateMutation.error && (
          <p className="mt-1 text-xs text-destructive">
            {(updateMutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
