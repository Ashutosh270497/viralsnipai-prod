"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, Radar, Unplug } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { SnipRadarProvider, useSnipRadar } from "@/components/snipradar/snipradar-context";
import { ActionBanner } from "@/components/snipradar/action-banner";

const ConnectXDialog = dynamic(() => import("@/components/snipradar/connect-x-dialog").then((m) => ({ default: m.ConnectXDialog })), { ssr: false });

function SnipRadarLayoutInner({ children }: { children: React.ReactNode }) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const processingRef = useRef(false);

  const {
    isLoading,
    error,
    apiError,
    recovery,
    isConnected,
    account,
    auth,
    profile,
    counts,
    invalidate,
  } = useSnipRadar();

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowDisconnect(false);
      invalidate();
    },
  });

  const hasDueDrafts = counts.dueScheduledDrafts > 0;
  const hasActiveAutomations = counts.activeAutoDmAutomations > 0;

  const processScheduled = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const res = await fetch("/api/snipradar/scheduled/process", { method: "POST" });
      if (!res.ok) return;

      const result = await res.json();
      if (result.posted > 0 || result.autoDm?.sent > 0) {
        invalidate();
      }
    } catch {
      // ignore polling errors
    } finally {
      processingRef.current = false;
    }
  }, [invalidate]);

  useEffect(() => {
    if (counts.scheduledDrafts === 0 && !hasActiveAutomations) return;

    if (hasDueDrafts || hasActiveAutomations) {
      processScheduled();
    }

    const pollMs = hasDueDrafts ? SNIPRADAR.POLL_INTERVAL_DUE_MS : SNIPRADAR.POLL_INTERVAL_MS;
    const interval = setInterval(() => {
      processScheduled();
    }, pollMs);

    return () => clearInterval(interval);
  }, [counts.scheduledDrafts, hasActiveAutomations, hasDueDrafts, processScheduled]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {recovery?.title ?? "Failed to load SnipRadar"}
            </p>
            <p className="text-sm text-muted-foreground">
              {recovery?.message ?? "Please refresh and try again."}
            </p>
            {recovery?.code ? (
              <p className="text-xs text-muted-foreground/70">Error code: {recovery.code}</p>
            ) : null}
          </div>
          <div className="flex justify-center gap-2">
            {recovery?.kind === "reauth" ? (
              <Button size="sm" onClick={() => setConnectOpen(true)}>
                {recovery.actionLabel}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => invalidate()}>
                {recovery?.actionLabel ?? "Retry"}
              </Button>
            )}
          </div>
        </CardContent>
        <ConnectXDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">SnipRadar</h1>
          <p className="text-sm text-muted-foreground">Grow your X presence with AI-powered viral analysis.</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
              <Radar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Connect your X account</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {profile.selectedNiche
                ? `Link your account to launch a ${profile.selectedNiche} starter radar, unlock discovery, and move into AI drafting fast.`
                : "Link your account to unlock discovery, draft generation, and growth analytics."}
            </p>
            {profile.selectedNiche ? (
              <p className="mt-2 max-w-md text-xs text-muted-foreground">
                After connect, SnipRadar will seed your first tracked accounts automatically so Discover is not empty on day one.
              </p>
            ) : null}
            <Button className="mt-5" onClick={() => setConnectOpen(true)}>
              Connect X Account
            </Button>
          </CardContent>
        </Card>

        <ConnectXDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Global action banner — fixed top, triggered via window events */}
      <ActionBanner />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shrink-0">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">SnipRadar</h1>
              {/* Username chip */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/[0.05] text-xs font-medium text-muted-foreground/80">
                @{account?.xUsername}
              </span>
              {/* Live dot */}
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </div>
            <p className="text-sm text-muted-foreground/60 mt-0.5">
              Discover what works, create faster, and publish smarter.
            </p>
          </div>
        </div>

        {/* Right: count chips + disconnect */}
        <div className="flex items-center gap-2">
          {counts.scheduledDrafts > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[11px] font-medium text-muted-foreground/60">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {counts.scheduledDrafts} scheduled
            </span>
          )}
          {counts.drafts > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[11px] font-medium text-muted-foreground/60">
              {counts.drafts} drafts
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowDisconnect(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400 text-xs font-medium text-muted-foreground/60 transition-all"
          >
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      </div>

      {auth?.reauthRequired || recovery?.kind === "reauth" ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">Reconnect X account required</p>
                <p className="text-xs text-amber-200/80">
                  {auth?.message ??
                    recovery?.message ??
                    "Live X metrics are unavailable until you reconnect your account."}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              Reconnect X
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {recovery &&
      recovery.kind !== "reauth" &&
      apiError &&
      apiError.status >= 400 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">{recovery.title}</p>
                <p className="text-xs text-amber-200/80">{recovery.message}</p>
              </div>
            </div>
            {recovery.retryable ? (
              <Button size="sm" variant="outline" onClick={() => invalidate()}>
                {recovery.actionLabel}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {children}

      <ConnectXDialog open={connectOpen} onOpenChange={setConnectOpen} />

      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect X Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This disconnects <span className="font-semibold text-foreground">@{account?.xUsername}</span> and clears auth tokens.
              Your tracked accounts, tweets, and drafts remain saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={disconnectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => disconnectMutation.mutate()}
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SnipRadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SnipRadarProvider>
      <SnipRadarLayoutInner>{children}</SnipRadarLayoutInner>
    </SnipRadarProvider>
  );
}
