"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radar, AtSign, ExternalLink, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConnectXDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectXDialog({ open, onOpenChange }: ConnectXDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const oauthMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "oauth" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start OAuth");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const manualMutation = useMutation({
    mutationFn: async (handle: string) => {
      const res = await fetch("/api/snipradar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual", username: handle }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to connect");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-discover-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      onOpenChange(false);
      setUsername("");
      setError(null);
      setMode("choose");
      router.push(`/snipradar/discover?connected=true&seeded=${data.seededStarterAccounts ?? 0}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode("choose");
      setUsername("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your X Account</DialogTitle>
          <DialogDescription>
            Choose how to connect your X (Twitter) account to start tracking
            growth and generating AI-powered tweets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <p className="text-sm text-red-500 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              {error}
            </p>
          )}

          {mode === "choose" && (
            <div className="space-y-3">
              {/* OAuth Option (Recommended) */}
              <button
                onClick={() => oauthMutation.mutate()}
                disabled={oauthMutation.isPending}
                className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">Connect with OAuth</p>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Recommended
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sign in via X.com to enable full features including posting tweets directly from SnipRadar.
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                      {oauthMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Redirecting to X.com...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-3 w-3" />
                          Opens X.com for authorization
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Manual Option */}
              <button
                onClick={() => setMode("manual")}
                className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent/5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <AtSign className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Connect with Username</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter your handle for read-only access. Track growth and analyze viral tweets, but posting will not be available.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setMode("choose");
                  setError(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to options
              </button>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Manual connect is read-only. You won&apos;t be able to post tweets. Use OAuth for full access.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="x-username" className="text-sm font-medium">
                  Your X Username
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="x-username"
                    placeholder="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && username.trim()) {
                        manualMutation.mutate(username);
                      }
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  if (!username.trim()) {
                    setError("Please enter your X username");
                    return;
                  }
                  setError(null);
                  manualMutation.mutate(username);
                }}
                disabled={manualMutation.isPending}
              >
                {manualMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Radar className="mr-2 h-4 w-4" />
                    Connect (Read-Only)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
