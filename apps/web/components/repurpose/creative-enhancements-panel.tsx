"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { cn, formatDuration } from "@/lib/utils";
import {
  CLIP_ENHANCEMENT_TYPES,
  normalizeEnhancementPayload,
  type BrollSuggestion,
  type ClipEnhancement,
  type ClipEnhancementType,
} from "@/lib/repurpose/creative-enhancements";

type EnhancementDraft = {
  type: ClipEnhancementType;
  startMs: number;
  endMs: number;
  payload: Record<string, unknown>;
};

const DEFAULT_DRAFT: EnhancementDraft = {
  type: "text_overlay",
  startMs: 0,
  endMs: 2500,
  payload: { text: "Big idea", position: "top" },
};

export function CreativeEnhancementsPanel({
  clipId,
  clipDurationMs,
  title,
  summary,
  onChanged,
}: {
  clipId: string;
  clipDurationMs: number;
  title?: string | null;
  summary?: string | null;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [enhancements, setEnhancements] = useState<ClipEnhancement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<BrollSuggestion[]>([]);
  const [draft, setDraft] = useState<EnhancementDraft>(DEFAULT_DRAFT);

  const loadEnhancements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/enhancements`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load enhancements");
      const body = await response.json();
      setEnhancements(body?.data?.enhancements ?? []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Enhancements unavailable",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [clipId, toast]);

  useEffect(() => {
    setDraft({
      ...DEFAULT_DRAFT,
      endMs: Math.min(2500, Math.max(500, clipDurationMs)),
    });
    setSuggestions([]);
    void loadEnhancements();
  }, [clipDurationMs, loadEnhancements]);

  const renderPlan = useMemo(() => {
    const enabled = enhancements.filter((item) => item.enabled);
    return {
      overlays: enabled.filter((item) =>
        ["text_overlay", "emoji", "keyword_highlight", "cta_card"].includes(item.type),
      ).length,
      bRoll: enabled.filter((item) => item.type === "b_roll").length,
      audio: enabled.filter((item) => item.type === "music_bed" || item.type === "sound_effect").length,
    };
  }, [enhancements]);

  async function createEnhancement(input: EnhancementDraft) {
    setSaving(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/enhancements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          endMs: Math.min(input.endMs, clipDurationMs),
          payload: normalizeEnhancementPayload(input.type, input.payload),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Failed to save enhancement");
      }
      toast({ title: "Enhancement saved", description: "It will be included in the export render plan." });
      await loadEnhancements();
      onChanged?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Enhancement not saved",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function patchEnhancement(id: string, patch: Partial<ClipEnhancement>) {
    const previous = enhancements;
    setEnhancements((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    try {
      const response = await fetch(`/api/clips/${clipId}/enhancements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to update enhancement");
      await loadEnhancements();
      onChanged?.();
    } catch {
      setEnhancements(previous);
      toast({ variant: "destructive", title: "Enhancement update failed" });
    }
  }

  async function deleteEnhancement(id: string) {
    const previous = enhancements;
    setEnhancements((items) => items.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/clips/${clipId}/enhancements/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to delete enhancement");
      onChanged?.();
    } catch {
      setEnhancements(previous);
      toast({ variant: "destructive", title: "Enhancement delete failed" });
    }
  }

  async function suggestBroll() {
    setSuggesting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/enhancements/suggest-broll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "short_form", tone: "premium creator" }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "B-roll suggestions failed");
      }
      const body = await response.json();
      setSuggestions(body?.data?.suggestions ?? []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not suggest B-roll",
        description:
          error instanceof Error
            ? error.message
            : "Check OpenRouter configuration and try again.",
      });
    } finally {
      setSuggesting(false);
    }
  }

  function updateDraftPayload(key: string, value: unknown) {
    setDraft((current) => ({ ...current, payload: { ...current.payload, [key]: value } }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={Type} label="Timed overlays" value={renderPlan.overlays} />
        <MetricCard icon={ImagePlus} label="B-roll moments" value={renderPlan.bRoll} />
        <MetricCard icon={Music2} label="Audio cues" value={renderPlan.audio} />
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
              Creative enhancement render plan
            </p>
            <h3 className="mt-1 text-base font-semibold">Overlays, B-roll, emojis, CTA, audio polish</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground/60">
              Enhancements are non-destructive. OpenRouter can suggest B-roll and keywords, but local
              render code owns exact placement and timing.
            </p>
          </div>
          <button
            type="button"
            onClick={suggestBroll}
            disabled={suggesting}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
          >
            {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Suggest B-roll
          </button>
        </div>

        {(title || summary) && (
          <div className="mt-3 rounded-lg border border-border/40 bg-background/35 p-3">
            <p className="line-clamp-1 text-xs font-semibold text-foreground">{title ?? "Selected clip"}</p>
            {summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground/55">{summary}</p>}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/70">
            OpenRouter B-roll suggestions
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <div key={`${suggestion.searchQuery}-${suggestion.startMs}`} className="rounded-lg border border-cyan-500/20 bg-background/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{suggestion.searchQuery}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/55">
                      {formatDuration(suggestion.startMs)} to {formatDuration(suggestion.endMs)} · {suggestion.visualStyle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      createEnhancement({
                        type: "b_roll",
                        startMs: suggestion.startMs,
                        endMs: suggestion.endMs,
                        payload: suggestion,
                      })
                    }
                    className="rounded-md bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-200"
                  >
                    Accept
                  </button>
                </div>
                {suggestion.reason && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground/55">{suggestion.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
            Add enhancement
          </p>
          <div className="mt-3 space-y-3">
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as ClipEnhancementType;
                  setDraft({
                    type,
                    startMs: 0,
                    endMs: Math.min(type === "music_bed" ? clipDurationMs : 3000, clipDurationMs),
                    payload: defaultPayloadForType(type),
                  });
                }}
                className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold"
              >
                {CLIP_ENHANCEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <input
                  type="number"
                  min={0}
                  max={clipDurationMs}
                  value={draft.startMs}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, startMs: Number(event.target.value) || 0 }))
                  }
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                />
              </Field>
              <Field label="End">
                <input
                  type="number"
                  min={draft.startMs + 100}
                  max={clipDurationMs}
                  value={draft.endMs}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, endMs: Number(event.target.value) || current.endMs }))
                  }
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                />
              </Field>
            </div>

            {(draft.type === "text_overlay" || draft.type === "cta_card") && (
              <>
                <Field label="Overlay text">
                  <input
                    value={String(draft.payload.text ?? "")}
                    onChange={(event) => updateDraftPayload("text", event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
                <Field label="Position">
                  <Segmented
                    value={String(draft.payload.position ?? "top")}
                    options={["top", "center", "bottom"]}
                    onChange={(value) => updateDraftPayload("position", value)}
                  />
                </Field>
              </>
            )}

            {draft.type === "emoji" && (
              <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                <Field label="Emoji">
                  <input
                    value={String(draft.payload.emoji ?? "")}
                    onChange={(event) => updateDraftPayload("emoji", event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
                <Field label="Label">
                  <input
                    value={String(draft.payload.label ?? "")}
                    onChange={(event) => updateDraftPayload("label", event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
              </div>
            )}

            {draft.type === "keyword_highlight" && (
              <Field label="Keyword">
                <input
                  value={String(draft.payload.keyword ?? "")}
                  onChange={(event) => updateDraftPayload("keyword", event.target.value)}
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                />
              </Field>
            )}

            {draft.type === "b_roll" && (
              <>
                <Field label="Search query">
                  <input
                    value={String(draft.payload.searchQuery ?? "")}
                    onChange={(event) => updateDraftPayload("searchQuery", event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
                <Field label="Custom media URL/path">
                  <input
                    value={String(draft.payload.mediaUrl ?? "")}
                    onChange={(event) => updateDraftPayload("mediaUrl", event.target.value)}
                    placeholder="Optional for future B-roll compositing"
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
              </>
            )}

            {(draft.type === "music_bed" || draft.type === "sound_effect") && (
              <>
                <Field label="Audio label">
                  <input
                    value={String(draft.payload.label ?? "")}
                    onChange={(event) => updateDraftPayload("label", event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs"
                  />
                </Field>
                <Field label={`Volume ${Math.round(Number(draft.payload.volume ?? 0.25) * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number(draft.payload.volume ?? 0.25)}
                    onChange={(event) => updateDraftPayload("volume", Number(event.target.value))}
                    className="w-full"
                  />
                </Field>
              </>
            )}

            <button
              type="button"
              onClick={() => createEnhancement(draft)}
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add enhancement
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
              Saved enhancements
            </p>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {enhancements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/50 bg-background/30 p-8 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/25" />
              <p className="text-sm font-semibold">No enhancements yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/55">
                Add a CTA card, text overlay, emoji moment, keyword highlight, B-roll note, or audio polish cue.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {enhancements.map((enhancement) => (
                <div
                  key={enhancement.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    enhancement.enabled
                      ? "border-border/50 bg-background/45"
                      : "border-border/30 bg-background/20 opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize">
                        {enhancement.type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/55">
                        {formatDuration(enhancement.startMs)} to {formatDuration(enhancement.endMs)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => patchEnhancement(enhancement.id, { enabled: !enhancement.enabled })}
                        className="grid h-8 w-8 place-items-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground"
                        aria-label={enhancement.enabled ? "Disable enhancement" : "Enable enhancement"}
                      >
                        {enhancement.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEnhancement(enhancement.id)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-red-500/20 text-red-300 hover:bg-red-500/10"
                        aria-label="Delete enhancement"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <EnhancementPayloadSummary enhancement={enhancement} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultPayloadForType(type: ClipEnhancementType): Record<string, unknown> {
  if (type === "cta_card") return { text: "Follow for more", position: "bottom" };
  if (type === "emoji") return { emoji: "🔥", label: "", position: "center" };
  if (type === "keyword_highlight") return { keyword: "important", color: "#FACC15" };
  if (type === "b_roll") return { searchQuery: "relevant cinematic b-roll", visualStyle: "editorial" };
  if (type === "music_bed") return { label: "Background music", volume: 0.18, normalizeLoudness: true };
  if (type === "sound_effect") return { label: "Soft impact", volume: 0.65 };
  return { text: "Big idea", position: "top" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/50 bg-background p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "h-7 rounded-md text-[11px] font-semibold capitalize transition-colors",
            value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EnhancementPayloadSummary({ enhancement }: { enhancement: ClipEnhancement }) {
  const payload = enhancement.payload ?? {};
  const primary =
    payload.text ??
    payload.keyword ??
    payload.searchQuery ??
    payload.label ??
    payload.emoji ??
    "Configured enhancement";
  const secondary =
    payload.reason ??
    payload.visualStyle ??
    payload.mediaUrl ??
    payload.audioUrl ??
    (enhancement.type === "b_roll"
      ? "B-roll search note saved. Attach media later for compositing."
      : null);
  return (
    <div className="mt-2 rounded-md border border-border/30 bg-muted/20 p-2">
      <p className="truncate text-xs font-medium text-foreground/85">{String(primary)}</p>
      {secondary && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground/55">{String(secondary)}</p>}
    </div>
  );
}
