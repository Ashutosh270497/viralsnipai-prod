"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Youtube, Radar, Loader2, Lock } from "lucide-react";

const YOUTUBE_ENABLED = process.env.NEXT_PUBLIC_YOUTUBE_ECOSYSTEM_ENABLED === "true";

import type { Ecosystem } from "@/lib/ecosystem";
import { getEcosystemHome, isRouteAllowedForEcosystem } from "@/lib/ecosystem";

interface EcosystemSelectScreenProps {
  userName?: string;
}

export function EcosystemSelectScreen({ userName }: EcosystemSelectScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<Ecosystem | null>(null);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/")) {
      return null;
    }
    return raw;
  }, [searchParams]);

  async function handleSelect(ecosystem: Ecosystem) {
    setPending(ecosystem);
    try {
      const response = await fetch("/api/ecosystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ecosystem }),
      });

      if (!response.ok) {
        throw new Error("Failed to save ecosystem preference");
      }

      const fallbackHome = getEcosystemHome(ecosystem);
      const destination =
        nextPath && isRouteAllowedForEcosystem(nextPath, ecosystem) ? nextPath : fallbackHome;
      router.replace(destination);
    } catch (error) {
      console.error("[Ecosystem Select] Failed to persist preference", error);
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-4xl flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Workspace Mode
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pick Your Creator Ecosystem
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {userName
            ? `${userName}, choose where you want to work first.`
            : "Choose where you want to work first."}{" "}
          You can switch anytime from the top-right toggle.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => handleSelect("x")}
          disabled={pending !== null}
          className="group rounded-2xl border border-border/70 bg-card/60 p-6 text-left transition hover:border-primary/40 hover:bg-card"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radar className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">X (Twitter)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Focus on SnipRadar workflows: discover viral patterns, generate drafts, publish, and
            analyze.
          </p>
          <div className="mt-5">
            <div className="inline-flex items-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
              {pending === "x" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enter X Ecosystem
            </div>
          </div>
        </button>

        {YOUTUBE_ENABLED ? (
          <button
            type="button"
            onClick={() => handleSelect("youtube")}
            disabled={pending !== null}
            className="group rounded-2xl border border-border/70 bg-card/60 p-6 text-left transition hover:border-primary/40 hover:bg-card"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">YouTube</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Focus on YouTube workflows: niche, keyword, script, thumbnail, repurpose, and publishing
              operations.
            </p>
            <div className="mt-5">
              <div className="inline-flex items-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                {pending === "youtube" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enter YouTube Ecosystem
              </div>
            </div>
          </button>
        ) : (
          <div className="relative rounded-2xl border border-border/40 bg-card/30 p-6 text-left opacity-60 cursor-not-allowed select-none">
            <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" />
              Coming Soon
            </div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-muted-foreground">YouTube</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              YouTube creator tools — niche research, keyword planner, script generator, thumbnail
              studio, and repurposing workflows. Launching soon.
            </p>
            <div className="mt-5">
              <div className="inline-flex items-center rounded-md border border-border/50 bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                Launching Soon
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
