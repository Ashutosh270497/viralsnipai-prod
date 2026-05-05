"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Copy, Loader2, Send, Share2, Sparkles } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { ProjectClip, ProjectExport } from "@/components/repurpose/types";

const SOCIAL_PLATFORMS = [
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "instagram_reels", label: "Instagram Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook_reels", label: "Facebook Reels" },
] as const;

type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["id"];

interface SocialPublishComposerProps {
  projectId: string;
  selectedClipIds: string[];
  clips: ProjectClip[];
  exports: ProjectExport[];
  defaultPlatform?: string;
}

export function SocialPublishComposer({
  projectId,
  selectedClipIds,
  clips,
  exports,
  defaultPlatform = "youtube_shorts",
}: SocialPublishComposerProps) {
  const { toast } = useToast();
  const initialPlatform = normalizePlatform(defaultPlatform);
  const [platform, setPlatform] = useState<SocialPlatform>(initialPlatform);
  const [clipId, setClipId] = useState(selectedClipIds[0] ?? clips[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === clipId) ?? clips[0] ?? null,
    [clipId, clips],
  );

  const bestExport = useMemo(() => {
    if (!selectedClip) return null;
    return exports.find((job) => {
      const done = job.status === "done" || job.status === "completed";
      const hasClip = Array.isArray(job.clipIds) ? job.clipIds.includes(selectedClip.id) : true;
      return done && hasClip && job.outputFormat !== "srt" && job.outputFormat !== "vtt";
    }) ?? null;
  }, [exports, selectedClip]);

  async function generateCopy() {
    if (!selectedClip) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/repurpose/social/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: selectedClip.id,
          platform,
          clipTitle: selectedClip.title ?? "",
          clipSummary: selectedClip.summary ?? "",
          transcriptExcerpt: selectedClip.captionSrt ?? "",
          cta: selectedClip.callToAction ?? "",
        }),
      });
      if (!response.ok) throw new Error(await extractError(response));
      const payload = await response.json();
      const copy = payload?.data?.copy;
      setTitle(copy?.title ?? selectedClip.title ?? "");
      setDescription(copy?.description ?? selectedClip.summary ?? "");
      setHashtags(Array.isArray(copy?.hashtags) ? copy.hashtags.join(" ") : "");
      setCta(copy?.cta ?? selectedClip.callToAction ?? "");
      toast({ title: "Platform copy generated", description: `Prepared ${labelForPlatform(platform)} metadata.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy generation failed",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveDraft(schedule = false) {
    if (!selectedClip) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/repurpose/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clipId: selectedClip.id,
          exportJobId: bestExport?.id ?? null,
          platform,
          title: title || selectedClip.title,
          description: description || selectedClip.summary,
          hashtags: parseHashtags(hashtags),
          cta: cta || selectedClip.callToAction,
          thumbnailUrl: selectedClip.thumbnail,
          videoUrl: bestExport?.outputPath ?? selectedClip.previewPath,
          scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          metadata: {
            source: "repurpose_export_composer",
            publisher: "mock_until_connected",
          },
        }),
      });
      if (!response.ok) throw new Error(await extractError(response));
      const payload = await response.json();
      setLastDraftId(payload?.data?.post?.id ?? null);
      toast({
        title: schedule ? "Post scheduled" : "Draft saved",
        description: schedule
          ? "Stored with the mock scheduler. Real platform adapters are marked Connect later."
          : "You can edit or schedule this draft later.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: schedule ? "Schedule failed" : "Draft save failed",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function createShareLink(permission: "view" | "review" | "approve") {
    if (!selectedClip) return;
    try {
      const response = await fetch("/api/repurpose/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, clipId: selectedClip.id, permission }),
      });
      if (!response.ok) throw new Error(await extractError(response));
      const payload = await response.json();
      const url = payload?.data?.link?.url;
      const absolute = url ? `${window.location.origin}${url}` : null;
      setShareUrl(absolute);
      if (absolute) await navigator.clipboard?.writeText(absolute).catch(() => undefined);
      toast({ title: "Review link created", description: absolute ? "Copied to clipboard." : "Link is ready." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Share link failed",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  if (clips.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Social post composer</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground/65">
            Prepare platform metadata, save drafts, schedule with mock publishing, or share clips for review.
          </p>
        </div>
        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          Adapters ready · connect later
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/45">Clip</span>
          <select value={clipId} onChange={(event) => setClipId(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {clips.map((clip, index) => (
              <option key={clip.id} value={clip.id}>
                {clip.title || `Clip ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/45">Platform</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value as SocialPlatform)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {SOCIAL_PLATFORMS.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Post title" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description or post copy" rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#hashtags" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <input value={cta} onChange={(event) => setCta(event.target.value)} placeholder="CTA" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={generateCopy} disabled={isGenerating} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate copy
        </button>
        <button type="button" onClick={() => saveDraft(false)} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-semibold transition hover:bg-muted/50 disabled:opacity-50">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Save draft
        </button>
        <button type="button" onClick={() => createShareLink("approve")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-semibold transition hover:bg-muted/50">
          <Share2 className="h-4 w-4" />
          Copy approval link
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/45">Schedule later</span>
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => saveDraft(true)} disabled={isSaving || !scheduledAt} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", scheduledAt ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground/50")}>
            <CalendarClock className="h-4 w-4" />
            Schedule mock
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/55">
          Mock scheduling persists the queue now. YouTube, TikTok, Instagram, X, LinkedIn, and Facebook adapters stay disabled until OAuth credentials are configured.
        </p>
      </div>

      {(lastDraftId || shareUrl) && (
        <div className="mt-4 space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-200/80">
          {lastDraftId ? <p>Draft ID: <span className="font-mono">{lastDraftId}</span></p> : null}
          {shareUrl ? (
            <button type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)} className="inline-flex items-center gap-2 text-left font-semibold text-emerald-200">
              <Copy className="h-3.5 w-3.5" />
              {shareUrl}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function normalizePlatform(value: string): SocialPlatform {
  if (value === "x_video") return "x";
  if (SOCIAL_PLATFORMS.some((entry) => entry.id === value)) return value as SocialPlatform;
  return "youtube_shorts";
}

function labelForPlatform(value: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((entry) => entry.id === value)?.label ?? value;
}

function parseHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
}

async function extractError(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? payload?.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
}
