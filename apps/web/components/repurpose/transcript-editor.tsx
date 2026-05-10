"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Type, RefreshCw, AlertTriangle, Search, Scissors, Copy, Plus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { CaptionOverlayStudio } from "@/components/repurpose/caption-overlay-studio";
import { RemotionClipPreview, type RemotionClipPreviewHandle } from "@/components/repurpose/remotion-clip-preview";
import { SourceQualityNotice } from "@/components/repurpose/source-quality-notice";
import { srtUtils, type CaptionEntry } from "@/lib/srt-utils";
import { getCaptionQuality, isPlaceholderCaptionText } from "@/lib/caption-quality";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";
import {
  DEFAULT_CLIP_CAPTION_STYLE,
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
} from "@/lib/repurpose/caption-style-config";
import { cn } from "@/lib/utils";
import {
  detectFillerWords,
  detectLongPauses,
  getClipSegments,
  getClipWords,
  getTranscriptPrecision,
  getWordAtTime,
  parseCanonicalTranscript,
  searchTranscript,
  type FillerWordMatch,
  type LongPauseMatch,
  type TranscriptUiWord,
} from "@/lib/repurpose/transcript-ui";
import {
  hideCaptionCue,
  mergeCaptionCues,
  splitCaptionCue,
  validateCaptionCues,
} from "@/lib/repurpose/caption-studio";
import type { ClipEditOperation } from "@/lib/types";
import type { ClipUpdatePayload } from "@/components/repurpose/use-clip-update-queue";
import type { ProjectClip } from "@/components/repurpose/types";

interface TranscriptEditorProps {
  mode?: "full" | "transcript" | "captions" | "style";
  clipId: string;
  clipTitle?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  onCaptionStyleChange?: (style: ClipCaptionStyleConfig) => void;
  expectedVersion: number;
  startMs: number;
  endMs: number;
  previewPath?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  smartReframePlan?: SmartReframePlan | null;
  projectId?: string | null;
  assetId?: string | null;
  assetTranscript?: string | null;
  selectedClipCount?: number;
  onApplyCaptionStyleToSelected?: (style: ClipCaptionStyleConfig) => Promise<void> | void;
  onUpdateClip?: (
    updates: ClipUpdatePayload,
    options?: { refresh?: boolean; retryOnConflict?: boolean; forcePreviewInvalidation?: boolean },
  ) => Promise<ProjectClip | undefined>;
  onSave: () => Promise<void>;
  onGenerateCaptions?: () => void;
  isGenerating?: boolean;
  showSourceQualityNotice?: boolean;
}

type TimedWord = {
  token: string;
  startMs: number;
  endMs: number;
};

type InferredTrimRange = {
  startMs: number;
  endMs: number;
  confidence: number;
  matchedTokens: number;
};

type InferredEditRange = {
  startMs: number;
  endMs: number;
  matchedTokens: number;
};

const WORD_TOKEN_REGEX = /[\p{L}\p{N}]+(?:[‘’-][\p{L}\p{N}]+)*/gu;
const MIN_TRIMMED_CLIP_DURATION_MS = 700;
const TRIM_DELTA_THRESHOLD_MS = 250;


export function normalizeEntryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeWordForMatch(word: string): string {
  return word.toLocaleLowerCase();
}

export function tokenizeWords(text: string): string[] {
  const tokens = text.match(WORD_TOKEN_REGEX) ?? [];
  return tokens.map(normalizeWordForMatch).filter(Boolean);
}

function extractWordTokensPreserveCase(text: string): string[] {
  const tokens = text.match(WORD_TOKEN_REGEX) ?? [];
  return tokens.map((token) => token.trim()).filter(Boolean);
}

function combineEntries(entries: CaptionEntry[]): string {
  return entries
    .map((entry) => normalizeEntryText(entry.text))
    .filter((text) => text.length > 0 && !isPlaceholderCaptionText(text))
    .join(" ")
    .trim();
}

function usesRelativeCueTimeline(entries: CaptionEntry[], clipDurationMs: number): boolean {
  if (entries.length === 0) {
    return true;
  }

  const maxEnd = Math.max(...entries.map((entry) => entry.endMs));
  const minStart = Math.min(...entries.map((entry) => entry.startMs));

  return maxEnd <= clipDurationMs + 2_000 && minStart >= -500;
}

export function clampCaptionEntriesToClipWindow(
  entries: CaptionEntry[],
  clipStartMs: number,
  clipEndMs: number
): CaptionEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const clipDurationMs = Math.max(1, clipEndMs - clipStartMs);
  const relativeTimeline = usesRelativeCueTimeline(entries, clipDurationMs);

  const windowStart = relativeTimeline ? 0 : clipStartMs;
  const windowEnd = relativeTimeline ? clipDurationMs : clipEndMs;

  return entries
    .map((entry) => {
      const normalizedText = normalizeEntryText(entry.text);
      if (!normalizedText) {
        return null;
      }

      const overlapStart = Math.max(windowStart, entry.startMs);
      const overlapEnd = Math.min(windowEnd, entry.endMs);

      if (overlapEnd <= overlapStart) {
        return null;
      }

      const startMs = relativeTimeline ? overlapStart : overlapStart - clipStartMs;
      const endMs = relativeTimeline ? overlapEnd : overlapEnd - clipStartMs;

      if (endMs <= startMs) {
        return null;
      }

      return {
        index: entry.index,
        startMs,
        endMs,
        text: normalizedText,
      } satisfies CaptionEntry;
    })
    .filter((entry): entry is CaptionEntry => entry !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function buildWordTimeline(entries: CaptionEntry[]): TimedWord[] {
  const timeline: TimedWord[] = [];

  for (const entry of entries) {
    if (isPlaceholderCaptionText(entry.text)) {
      continue;
    }

    const words = tokenizeWords(entry.text);
    if (words.length === 0) {
      continue;
    }

    const durationMs = Math.max(1, entry.endMs - entry.startMs);
    const stepMs = durationMs / words.length;

    for (let index = 0; index < words.length; index += 1) {
      const startMs = Math.max(0, Math.round(entry.startMs + index * stepMs));
      const endMs =
        index === words.length - 1
          ? Math.max(startMs + 1, entry.endMs)
          : Math.max(startMs + 1, Math.round(entry.startMs + (index + 1) * stepMs));

      timeline.push({
        token: words[index],
        startMs,
        endMs,
      });
    }
  }

  return timeline.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function inferTrimRangeFromEditedText(
  editedText: string,
  timeline: TimedWord[]
): InferredTrimRange | null {
  if (timeline.length === 0) {
    return null;
  }

  const editedTokens = tokenizeWords(editedText);
  if (editedTokens.length === 0) {
    return null;
  }

  const matchedIndices: number[] = [];
  let cursor = 0;

  for (const token of editedTokens) {
    let foundIndex = -1;

    for (let index = cursor; index < timeline.length; index += 1) {
      if (timeline[index].token === token) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      matchedIndices.push(foundIndex);
      cursor = foundIndex + 1;
    }
  }

  if (matchedIndices.length === 0) {
    return null;
  }

  const confidence = matchedIndices.length / editedTokens.length;
  if (confidence < 0.45) {
    return null;
  }

  const first = timeline[matchedIndices[0]];
  const last = timeline[matchedIndices[matchedIndices.length - 1]];

  if (!first || !last || last.endMs <= first.startMs) {
    return null;
  }

  return {
    startMs: first.startMs,
    endMs: last.endMs,
    confidence,
    matchedTokens: matchedIndices.length,
  };
}

export function inferEditRangesFromEditedText(
  editedText: string,
  timeline: TimedWord[]
): InferredEditRange[] | null {
  if (timeline.length === 0) {
    return null;
  }

  const editedTokens = tokenizeWords(editedText);
  if (editedTokens.length === 0) {
    return null;
  }

  const matchedIndices: number[] = [];
  let cursor = 0;

  for (const token of editedTokens) {
    let foundIndex = -1;

    for (let index = cursor; index < timeline.length; index += 1) {
      if (timeline[index].token === token) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      matchedIndices.push(foundIndex);
      cursor = foundIndex + 1;
    }
  }

  if (matchedIndices.length === 0) {
    return null;
  }

  const confidence = matchedIndices.length / editedTokens.length;
  if (confidence < 0.45) {
    return null;
  }

  const ranges: InferredEditRange[] = [];
  let rangeStartIdx = matchedIndices[0];
  let previousIdx = matchedIndices[0];

  for (let i = 1; i < matchedIndices.length; i += 1) {
    const currentIdx = matchedIndices[i];
    if (currentIdx !== previousIdx + 1) {
      const first = timeline[rangeStartIdx];
      const last = timeline[previousIdx];
      if (first && last && last.endMs > first.startMs) {
        ranges.push({
          startMs: first.startMs,
          endMs: last.endMs,
          matchedTokens: previousIdx - rangeStartIdx + 1,
        });
      }
      rangeStartIdx = currentIdx;
    }
    previousIdx = currentIdx;
  }

  const lastRangeFirst = timeline[rangeStartIdx];
  const lastRangeLast = timeline[previousIdx];
  if (lastRangeFirst && lastRangeLast && lastRangeLast.endMs > lastRangeFirst.startMs) {
    ranges.push({
      startMs: lastRangeFirst.startMs,
      endMs: lastRangeLast.endMs,
      matchedTokens: previousIdx - rangeStartIdx + 1,
    });
  }

  const MIN_RANGE_MS = 120;
  const MERGE_GAP_MS = 220;
  const merged: InferredEditRange[] = [];

  for (const range of ranges) {
    if (range.endMs - range.startMs < MIN_RANGE_MS) {
      continue;
    }
    const previous = merged[merged.length - 1];
    if (previous && range.startMs - previous.endMs <= MERGE_GAP_MS) {
      previous.endMs = Math.max(previous.endMs, range.endMs);
      previous.matchedTokens += range.matchedTokens;
    } else {
      merged.push({ ...range });
    }
  }

  return merged.length > 0 ? merged : null;
}

function buildTimedCaptionEntriesFromEditedText(
  editedText: string,
  timeline: TimedWord[],
  maxWordsPerCue = 4
): CaptionEntry[] | null {
  if (timeline.length === 0) {
    return null;
  }

  const displayTokens = extractWordTokensPreserveCase(editedText);
  if (displayTokens.length === 0) {
    return null;
  }

  const normalizedTokens = displayTokens.map(normalizeWordForMatch);
  const assignments: Array<{ text: string; startMs: number; endMs: number }> = [];
  const LOOKAHEAD = 8;
  let timelineCursor = 0;

  for (let tokenIndex = 0; tokenIndex < normalizedTokens.length; tokenIndex += 1) {
    const normalizedToken = normalizedTokens[tokenIndex];
    const originalToken = displayTokens[tokenIndex];

    if (timelineCursor >= timeline.length) {
      break;
    }

    let matchedTimelineIndex = -1;
    if (timeline[timelineCursor]?.token === normalizedToken) {
      matchedTimelineIndex = timelineCursor;
    } else {
      const upperBound = Math.min(timeline.length, timelineCursor + LOOKAHEAD);
      for (let i = timelineCursor + 1; i < upperBound; i += 1) {
        if (timeline[i]?.token === normalizedToken) {
          matchedTimelineIndex = i;
          break;
        }
      }
    }

    if (matchedTimelineIndex === -1) {
      matchedTimelineIndex = timelineCursor;
    }

    const slot = timeline[matchedTimelineIndex];
    assignments.push({
      text: originalToken,
      startMs: slot.startMs,
      endMs: slot.endMs,
    });
    timelineCursor = matchedTimelineIndex + 1;
  }

  if (assignments.length === 0) {
    return null;
  }

  if (assignments.length < displayTokens.length) {
    const fallbackSlot = assignments[assignments.length - 1];
    for (let i = assignments.length; i < displayTokens.length; i += 1) {
      assignments.push({
        text: displayTokens[i],
        startMs: fallbackSlot.startMs,
        endMs: fallbackSlot.endMs,
      });
    }
  }

  const chunkedEntries: CaptionEntry[] = [];
  for (let i = 0; i < assignments.length; i += maxWordsPerCue) {
    const chunk = assignments.slice(i, i + maxWordsPerCue);
    const startMs = Math.max(0, chunk[0]?.startMs ?? 0);
    const endMs = Math.max(startMs + 120, chunk[chunk.length - 1]?.endMs ?? startMs + 120);
    chunkedEntries.push({
      index: chunkedEntries.length + 1,
      startMs,
      endMs,
      text: chunk.map((word) => word.text).join(" ").trim(),
    });
  }

  const normalizedEntries: CaptionEntry[] = [];
  let cursorMs = 0;
  for (const entry of chunkedEntries) {
    const text = normalizeEntryText(entry.text);
    if (!text) continue;
    const startMs = Math.max(cursorMs, entry.startMs);
    const endMs = Math.max(startMs + 120, entry.endMs);
    normalizedEntries.push({
      index: normalizedEntries.length + 1,
      startMs,
      endMs,
      text,
    });
    cursorMs = endMs;
  }

  return normalizedEntries.length > 0 ? normalizedEntries : null;
}

export function TranscriptEditor({
  mode = "full",
  clipId,
  clipTitle,
  captionSrt,
  captionStyle,
  onCaptionStyleChange,
  expectedVersion,
  startMs,
  endMs,
  previewPath,
  sourceWidth,
  sourceHeight,
  smartReframePlan,
  projectId,
  assetId,
  assetTranscript,
  selectedClipCount,
  onApplyCaptionStyleToSelected,
  onUpdateClip,
  onSave,
  onGenerateCaptions,
  isGenerating,
  showSourceQualityNotice = true,
}: TranscriptEditorProps) {
  const { toast } = useToast();
  const remotionPreviewRef = useRef<RemotionClipPreviewHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);

  const [entries, setEntries] = useState<CaptionEntry[]>([]);
  const [initialEntries, setInitialEntries] = useState<CaptionEntry[]>([]);
  const [initialCaptionStyle, setInitialCaptionStyle] = useState<ClipCaptionStyleConfig>(
    DEFAULT_CLIP_CAPTION_STYLE
  );
  const [undoKey, setUndoKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [captionStyleDraft, setCaptionStyleDraft] = useState<ClipCaptionStyleConfig>(
    () => normalizeClipCaptionStyle(captionStyle)
  );
  const [subtitlesPreviewEnabled, setSubtitlesPreviewEnabled] = useState(true);
  const [selectedWordRange, setSelectedWordRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [editOperations, setEditOperations] = useState<ClipEditOperation[]>([]);
  const [operationLoading, setOperationLoading] = useState(false);
  const [fullTranscriptSearchQuery, setFullTranscriptSearchQuery] = useState("");
  const [captionTranslateLanguage, setCaptionTranslateLanguage] = useState("hi");
  const safeCaptionStyle = captionStyleDraft;

  useEffect(() => {
    const parsed = captionSrt ? srtUtils.parseSRT(captionSrt) : [];
    const normalized = parsed.map((entry) => ({
      ...entry,
      text: normalizeEntryText(entry.text),
    }));
    const clippedEntries = clampCaptionEntriesToClipWindow(normalized, startMs, endMs);
    setEntries(clippedEntries);
    setInitialEntries(clippedEntries);
    const normalizedStyle = normalizeClipCaptionStyle(captionStyle);
    setInitialCaptionStyle(normalizedStyle);
    setCaptionStyleDraft(normalizedStyle);
    setSearchQuery("");
    setSelectedWordRange(null);
    setFullTranscriptSearchQuery("");
    setUndoKey(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionSrt, clipId, startMs, endMs]); // captionStyle intentionally excluded — only reset on clip change

  const hasEntryChanges = useMemo(
    () => JSON.stringify(entries) !== JSON.stringify(initialEntries),
    [entries, initialEntries]
  );
  const hasStyleChanges =
    JSON.stringify(safeCaptionStyle) !== JSON.stringify(initialCaptionStyle);
  const hasChanges = hasEntryChanges || hasStyleChanges;
  const wordTimeline = useMemo(() => buildWordTimeline(entries), [entries]);
  const parsedTranscript = useMemo(() => parseCanonicalTranscript(assetTranscript), [assetTranscript]);
  const transcriptPrecision = useMemo(
    () => getTranscriptPrecision(assetTranscript),
    [assetTranscript],
  );
  const clipWords = useMemo(
    () => getClipWords(parsedTranscript, startMs, endMs),
    [endMs, parsedTranscript, startMs],
  );
  const clipSegments = useMemo(
    () => getClipSegments(parsedTranscript, startMs, endMs),
    [endMs, parsedTranscript, startMs],
  );
  const activeWord = useMemo(
    () => getWordAtTime(parsedTranscript, startMs + currentMs),
    [currentMs, parsedTranscript, startMs],
  );
  const fillerMatches = useMemo(() => {
    const clipWordIndices = new Set(clipWords.map((word) => word.index));
    return detectFillerWords(parsedTranscript).filter(
      (match) => clipWordIndices.has(match.wordStartIndex) || clipWordIndices.has(match.wordEndIndex),
    );
  }, [clipWords, parsedTranscript]);
  const pauseMatches = useMemo(() => {
    const clipWordIndices = new Set(clipWords.map((word) => word.index));
    return detectLongPauses(parsedTranscript, 900).filter(
      (match) => clipWordIndices.has(match.beforeWordIndex) || clipWordIndices.has(match.afterWordIndex),
    );
  }, [clipWords, parsedTranscript]);
  const fullTranscriptSearchResults = useMemo(
    () => searchTranscript(parsedTranscript, fullTranscriptSearchQuery, { limit: 8 }),
    [fullTranscriptSearchQuery, parsedTranscript],
  );

  const clipScopedCaptionSrt = useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    return srtUtils.buildSRT(
      entries.map((entry, index) => ({
        ...entry,
        index: index + 1,
      }))
    );
  }, [entries]);

  const captionQuality = useMemo(() => getCaptionQuality(clipScopedCaptionSrt), [clipScopedCaptionSrt]);

  const durationMs = Math.max(1, endMs - startMs);

  function handleUndo() {
    setEntries(initialEntries);
    setCaptionStyleDraft(initialCaptionStyle);
    onCaptionStyleChange?.(initialCaptionStyle);
    setUndoKey((k) => k + 1);
  }

  function handleCaptionStyleChange(nextStyle: ClipCaptionStyleConfig) {
    const normalizedStyle = normalizeClipCaptionStyle(nextStyle);
    setCaptionStyleDraft(normalizedStyle);
    onCaptionStyleChange?.(normalizedStyle);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadOperations() {
      try {
        const response = await fetch(`/api/clips/${clipId}/edit-operations`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as
          | { data?: { operations?: ClipEditOperation[] } }
          | null;
        if (!cancelled) {
          setEditOperations(payload?.data?.operations ?? []);
        }
      } catch {
        if (!cancelled) {
          setEditOperations([]);
        }
      }
    }
    void loadOperations();
    return () => {
      cancelled = true;
    };
  }, [clipId]);

  function getSelectedWords(): TranscriptUiWord[] {
    if (!selectedWordRange) return [];
    const min = Math.min(selectedWordRange.startIndex, selectedWordRange.endIndex);
    const max = Math.max(selectedWordRange.startIndex, selectedWordRange.endIndex);
    return clipWords.filter((word) => word.index >= min && word.index <= max);
  }

  function selectWord(word: TranscriptUiWord, additive: boolean) {
    if (additive && selectedWordRange) {
      setSelectedWordRange({
        startIndex: selectedWordRange.startIndex,
        endIndex: word.index,
      });
      return;
    }
    setSelectedWordRange({ startIndex: word.index, endIndex: word.index });
  }

  async function saveEditOperation(input: {
    type: ClipEditOperation["type"];
    startMs?: number | null;
    endMs?: number | null;
    payload?: Record<string, unknown>;
  }) {
    const response = await fetch(`/api/clips/${clipId}/edit-operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Failed to save edit operation");
    }
    const payload = (await response.json().catch(() => null)) as
      | { data?: { operation?: ClipEditOperation } }
      | null;
    const operation = payload?.data?.operation;
    if (operation) {
      setEditOperations((prev) => [...prev, operation]);
    }
  }

  async function applyWordBoundary(kind: "start" | "end", word: TranscriptUiWord) {
    if (isGenerating) {
      toast({
        title: "Caption update in progress",
        description: "Wait for the preview refresh to finish before changing clip timing.",
      });
      return;
    }

    const nextStartMs = kind === "start" ? Math.max(0, word.startMs - 300) : startMs;
    const nextEndMs = kind === "end" ? Math.max(word.endMs + 500, word.endMs) : endMs;
    if (nextEndMs <= nextStartMs || nextEndMs - nextStartMs < MIN_TRIMMED_CLIP_DURATION_MS) {
      toast({
        variant: "destructive",
        title: "Boundary too short",
        description: "Choose a wider transcript range before applying this trim.",
      });
      return;
    }

    setOperationLoading(true);
    try {
      if (onUpdateClip) {
        await onUpdateClip(
          {
            startMs: nextStartMs,
            endMs: nextEndMs,
            previewPath: null,
          },
          { refresh: false, forcePreviewInvalidation: true },
        );
      } else {
        const response = await fetch(`/api/clips/${clipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startMs: nextStartMs,
            endMs: nextEndMs,
            previewPath: null,
            expectedVersion,
          }),
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to update clip boundary");
        }
      }
      await saveEditOperation({
        type: kind === "start" ? "trim_start" : "trim_end",
        startMs: kind === "start" ? nextStartMs : startMs,
        endMs: kind === "end" ? nextEndMs : endMs,
        payload: {
          wordIndex: word.index,
          word: word.word,
          originalStartMs: startMs,
          originalEndMs: endMs,
          appliedAt: new Date().toISOString(),
        },
      });
      toast({
        title: "Clip boundary updated",
        description: "Timing was snapped to transcript word timing. Preview will rebuild on the next caption refresh.",
      });
      await onSave();
    } catch {
      toast({
        variant: "destructive",
        title: "Trim failed",
        description: "Unable to apply transcript trim. Refresh and try again.",
      });
    } finally {
      setOperationLoading(false);
    }
  }

  async function markRemoveRanges(
    ranges: Array<FillerWordMatch | LongPauseMatch>,
    source: "fillers" | "pauses" | "selection",
  ) {
    if (ranges.length === 0) return;
    setOperationLoading(true);
    try {
      for (const range of ranges) {
        await saveEditOperation({
          type: "remove_range",
          startMs: range.startMs,
          endMs: range.endMs,
          payload: {
            source,
            text: "text" in range ? range.text : undefined,
            durationMs: "durationMs" in range ? range.durationMs : undefined,
          },
        });
      }
      toast({
        title: source === "fillers" ? "Fillers marked for removal" : source === "pauses" ? "Pauses marked for removal" : "Selection marked for removal",
        description: "These edits are non-destructive and will be respected by the export render plan.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Edit failed",
        description: "Unable to save removal operations.",
      });
    } finally {
      setOperationLoading(false);
    }
  }

  async function removeSelectedWords() {
    const selected = getSelectedWords();
    if (selected.length === 0) return;
    await markRemoveRanges(
      [
        {
          id: "selected",
          startMs: selected[0].startMs,
          endMs: selected[selected.length - 1].endMs,
          text: selected.map((word) => word.word).join(" "),
          wordStartIndex: selected[0].index,
          wordEndIndex: selected[selected.length - 1].index,
        },
      ],
      "selection",
    );
  }

  async function resetEditOperations() {
    setOperationLoading(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/edit-operations/reset`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to reset edits");
      }
      setEditOperations([]);
      setSelectedWordRange(null);
      toast({ title: "Transcript edits reset", description: "Non-destructive edit operations were cleared." });
      await onSave();
    } catch {
      toast({ variant: "destructive", title: "Reset failed", description: "Unable to reset transcript edits." });
    } finally {
      setOperationLoading(false);
    }
  }

  async function copySelectedQuote() {
    const quote = getSelectedWords().map((word) => word.word).join(" ").trim();
    if (!quote) return;
    await navigator.clipboard?.writeText(quote);
    toast({ title: "Quote copied" });
  }

  async function createClipFromSelection(words: TranscriptUiWord[]) {
    if (!projectId || !assetId || words.length === 0) return;
    setOperationLoading(true);
    try {
      const response = await fetch("/api/repurpose/clips/from-transcript-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetId,
          startWordIndex: words[0].index,
          endWordIndex: words[words.length - 1].index,
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to create clip");
      }
      toast({ title: "Clip created", description: "A new clip was created from the transcript selection." });
      await onSave();
    } catch {
      toast({
        variant: "destructive",
        title: "Clip creation failed",
        description: "Unable to create a clip from this transcript selection.",
      });
    } finally {
      setOperationLoading(false);
    }
  }

  async function runCaptionAssist(
    endpoint: "cleanup" | "highlight-keywords" | "translate",
    options: { mode?: string; language?: string } = {},
  ) {
    if (entries.length === 0) return;
    setOperationLoading(true);
    try {
      const response = await fetch(`/api/repurpose/captions/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId,
          cues: entries.map((entry, index) => ({ ...entry, index: index + 1 })),
          mode: options.mode ?? "cleanup",
          language: options.language,
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Caption assist failed");
      }
      const payload = (await response.json().catch(() => null)) as
        | { data?: { cues?: CaptionEntry[]; srt?: string; track?: { language?: string; label?: string | null } } }
        | null;
      const nextEntries = payload?.data?.cues;
      if (Array.isArray(nextEntries) && nextEntries.length > 0) {
        setEntries(validateCaptionCues(nextEntries));
      }
      toast({
        title: endpoint === "translate" ? "Caption track translated" : "Caption assist applied",
        description:
          endpoint === "translate"
            ? `${payload?.data?.track?.label ?? options.language ?? "Translated"} captions are now active in the editor.`
            : "Cue timings were preserved while text was updated.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Caption assist failed",
        description: "Unable to update captions with AI. Timing was not changed.",
      });
    } finally {
      setOperationLoading(false);
    }
  }

  function updateEntryText(idx: number, newText: string) {
    const normalized = normalizeEntryText(newText);
    if (!normalized) return;
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, text: normalized } : e)));
  }

  function splitEntry(idx: number) {
    setEntries((prev) => splitCaptionCue(prev, idx));
  }

  function mergeWithNext(idx: number) {
    setEntries((prev) => mergeCaptionCues(prev, idx));
  }

  function hideEntry(idx: number) {
    setEntries((prev) => hideCaptionCue(prev, idx));
  }

  function adjustEntryTiming(idx: number, key: "startMs" | "endMs", value: number) {
    setEntries((prev) =>
      validateCaptionCues(
        prev.map((entry, index) =>
          index === idx ? { ...entry, [key]: Math.max(0, Math.round(value)) } : entry,
        ),
      ),
    );
  }

  const displayEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries.map((e, i) => ({ entry: e, idx: i }));
    return entries.map((e, i) => ({ entry: e, idx: i })).filter(({ entry }) =>
      entry.text.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  async function handleSave() {
    if (!hasChanges) return;
    if (isGenerating) {
      toast({
        title: "Preview refresh in progress",
        description: "Wait for captions and preview regeneration to finish before saving more changes.",
      });
      return;
    }

    const combinedText = entries.map((e) => e.text).join(" ").trim();
    if (!combinedText) {
      toast({
        variant: "destructive",
        title: "Transcript is empty",
        description: "Add transcript text or regenerate captions before saving.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const normalizedCaptionStyle = normalizeClipCaptionStyle(safeCaptionStyle);
      let nextStartMs = startMs;
      let nextEndMs = endMs;
      let retimedFromTranscript = false;

      const inferredRange = inferTrimRangeFromEditedText(combinedText, wordTimeline);
      const inferredEditRanges = inferEditRangesFromEditedText(combinedText, wordTimeline);
      if (inferredRange) {
        const candidateStart = startMs + inferredRange.startMs;
        const candidateEnd = startMs + inferredRange.endMs;
        if (
          candidateEnd - candidateStart >= MIN_TRIMMED_CLIP_DURATION_MS &&
          candidateStart >= 0 &&
          candidateEnd > candidateStart
        ) {
          const startDelta = Math.abs(candidateStart - startMs);
          const endDelta = Math.abs(candidateEnd - endMs);
          if (startDelta >= TRIM_DELTA_THRESHOLD_MS || endDelta >= TRIM_DELTA_THRESHOLD_MS) {
            nextStartMs = candidateStart;
            nextEndMs = candidateEnd;
            retimedFromTranscript = true;
          }
        }
      }

      const absoluteEditRanges = inferredEditRanges
        ? inferredEditRanges.map((range) => ({
            startMs: startMs + range.startMs,
            endMs: startMs + range.endMs,
          }))
        : null;
      const hasInternalEditCuts = Boolean(absoluteEditRanges && absoluteEditRanges.length > 1);

      // Build SRT directly from current per-segment entries.
      const captionSrtToPersist = srtUtils.buildSRT(
        entries.map((e, i) => ({ ...e, index: i + 1 }))
      );

      const patchPayload: {
        captionSrt: string;
        startMs: number;
        endMs: number;
        captionStyle: ClipCaptionStyleConfig;
        previewPath?: null;
        transcriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
        expectedVersion: number;
      } = {
        captionSrt: captionSrtToPersist,
        startMs: nextStartMs,
        endMs: nextEndMs,
        captionStyle: normalizedCaptionStyle,
        transcriptEditRangesMs: hasInternalEditCuts ? absoluteEditRanges : null,
        expectedVersion,
      };

      if (retimedFromTranscript) {
        patchPayload.previewPath = null;
      }

      const updatedClip = onUpdateClip
        ? await onUpdateClip(patchPayload, {
            refresh: false,
            forcePreviewInvalidation: retimedFromTranscript,
          })
        : null;

      let updatePayload:
        | {
            data?: {
              clip?: { startMs?: number; endMs?: number; version?: number };
              normalizedTranscriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
            };
          }
        | null = updatedClip
        ? {
            data: {
              clip: updatedClip,
              normalizedTranscriptEditRangesMs:
                (updatedClip.viralityFactors?.metadata?.transcriptEditRangesMs as
                  | Array<{ startMs: number; endMs: number }>
                  | undefined) ?? null,
            },
          }
        : null;

      if (!onUpdateClip) {
        const updateResponse = await fetch(`/api/clips/${clipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
          cache: "no-store",
        });

        if (!updateResponse.ok) throw new Error("Failed to save transcript");
        updatePayload = (await updateResponse.json().catch(() => null)) as
          | {
              data?: {
                clip?: { startMs?: number; endMs?: number; version?: number };
                normalizedTranscriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
              };
            }
          | null;
      }
      const persistedStartMs = Number(updatePayload?.data?.clip?.startMs);
      const persistedEndMs = Number(updatePayload?.data?.clip?.endMs);
      if (Number.isFinite(persistedStartMs) && Number.isFinite(persistedEndMs) && persistedEndMs > persistedStartMs) {
        nextStartMs = persistedStartMs;
        nextEndMs = persistedEndMs;
      }
      if (retimedFromTranscript || hasInternalEditCuts) {
        const regenerateResponse = await fetch("/api/repurpose/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clipId, force: true, preserveExistingCaptionSrt: true }),
          cache: "no-store",
        });
        if (!regenerateResponse.ok) {
          toast({ title: "Clip timing synced", description: "Transcript saved, but preview refresh failed. Regenerate captions to refresh preview." });
        }
      }

      toast({
        title: "Transcript updated",
        description: hasInternalEditCuts
          ? "Saved. Internal transcript deletions will be applied in export render."
          : retimedFromTranscript
            ? "Transcript and clip timing are now synchronized."
            : `Saved ${entries.length} segment${entries.length !== 1 ? "s" : ""}.`,
      });

      setInitialEntries(entries);
      setInitialCaptionStyle(normalizedCaptionStyle);
      await onSave();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Unable to save transcript. Please retry." });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Video progress bar sync ──────────────────────────────────────────────────
  const handlePreviewTimeUpdate = useCallback((ms: number) => {
    const durationMs = Math.max(1, endMs - startMs);
    setVideoProgress(Math.min(100, Math.max(0, (ms / durationMs) * 100)));
    setCurrentMs(ms);
  }, [endMs, startMs]);

  const videoPlayer = previewPath ? (
    <RemotionClipPreview
      ref={remotionPreviewRef}
      previewPath={previewPath}
      entries={entries}
      captionStyle={safeCaptionStyle}
      subtitlesEnabled={subtitlesPreviewEnabled}
      durationMs={Math.max(1, endMs - startMs)}
      smartReframePlan={smartReframePlan}
      onTimeUpdate={handlePreviewTimeUpdate}
    />
  ) : null;

  const missingPreviewNotice =
    !previewPath && onGenerateCaptions ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Clip preview is unavailable. Rebuild captions to regenerate the playable preview and thumbnail.</span>
        </div>
        <Button variant="secondary" size="sm" className="h-7 shrink-0" onClick={onGenerateCaptions} disabled={isGenerating}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isGenerating && "animate-spin")} />
          {isGenerating ? "Rebuilding..." : "Rebuild preview"}
        </Button>
      </div>
    ) : null;
  const generatingNotice = isGenerating ? (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      <span>Captions generating. Preview will refresh when this finishes.</span>
    </div>
  ) : null;
  const sourceQualityNotice = showSourceQualityNotice ? (
    <SourceQualityNotice
      sourceWidth={sourceWidth}
      sourceHeight={sourceHeight}
      targetWidth={1080}
      targetHeight={1920}
      compact
    />
  ) : null;
  const showVideoPlayer = mode === "full" || mode === "captions";
  const showWordEditor = mode === "full";
  const showAdvancedTranscript = mode === "transcript";
  const showCaptionTools = mode === "full" || mode === "captions";
  const showSegmentEditor = mode !== "style";
  const showStyleStudio = mode === "full" || mode === "style";

  if ((!captionSrt || entries.length === 0) && clipWords.length === 0) {
    return (
      <div className="space-y-3">
        {showVideoPlayer && videoPlayer}
        {sourceQualityNotice}
        {generatingNotice}
        {missingPreviewNotice}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center">
          <Type className="mb-2 h-7 w-7 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground/80">No transcript available</p>
          <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/50">Generate captions to create an editable transcript.</p>
          {onGenerateCaptions && (
            <Button variant="default" size="sm" className="mt-4 gap-1.5" onClick={onGenerateCaptions} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
              {isGenerating ? "Generating..." : "Generate Captions"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (captionQuality.tier === "low_quality" && clipWords.length === 0) {
    return (
      <div className="space-y-3">
        {showVideoPlayer && videoPlayer}
        {sourceQualityNotice}
        {generatingNotice}
        {missingPreviewNotice}
        <div className="flex flex-col items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-8 text-center">
          <AlertTriangle className="mb-2 h-7 w-7 text-amber-500/60" />
          <p className="text-sm font-medium text-foreground/80">Transcript quality is too low</p>
          <p className="mt-1 max-w-[320px] text-xs text-muted-foreground/60">Captions are mostly unusable. Regenerate to get a clean transcript.</p>
          {onGenerateCaptions && (
            <Button variant="default" size="sm" className="mt-4 gap-1.5" onClick={onGenerateCaptions} disabled={isGenerating}>
              <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
              {isGenerating ? "Regenerating..." : "Regenerate Captions"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showVideoPlayer && videoPlayer}
      {sourceQualityNotice}
      {generatingNotice}
      {missingPreviewNotice}

      {mode === "transcript" && (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
          <p className="text-sm font-semibold text-foreground">Edit transcript</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground/60">
            Clean the readable transcript first. Use advanced word timing only when you need exact
            start, end, or removal ranges.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={operationLoading}
              onClick={() => void runCaptionAssist("cleanup", { mode: "cleanup" })}
            >
              Clean
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={operationLoading}
              onClick={() => void markRemoveRanges(fillerMatches, "fillers")}
            >
              Remove fillers
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={operationLoading}
              onClick={() => void markRemoveRanges(pauseMatches, "pauses")}
            >
              Shorten pauses
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={operationLoading}
              onClick={() => void runCaptionAssist("cleanup", { mode: "simplify" })}
            >
              Simplify
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={operationLoading}
              onClick={() =>
                void runCaptionAssist("translate", { language: captionTranslateLanguage })
              }
            >
              Translate
            </Button>
          </div>
        </div>
      )}

      {showWordEditor && (
        <WordLevelTranscriptPanel
          precision={transcriptPrecision}
          words={clipWords}
          segments={clipSegments}
          selectedRange={selectedWordRange}
          activeWordIndex={activeWord?.index ?? null}
          fillerCount={fillerMatches.length}
          pauseCount={pauseMatches.length}
          operationCount={editOperations.length}
          isBusy={operationLoading || Boolean(isGenerating)}
          searchQuery={fullTranscriptSearchQuery}
          searchResults={fullTranscriptSearchResults}
          onSearchChange={setFullTranscriptSearchQuery}
          onWordClick={(word, event) => {
            selectWord(word, event.shiftKey);
            remotionPreviewRef.current?.seekToMs(Math.max(0, word.startMs - startMs));
            handlePreviewTimeUpdate(Math.max(0, word.startMs - startMs));
          }}
          onClearSelection={() => setSelectedWordRange(null)}
          onSetStart={() => {
            const selected = getSelectedWords();
            const first = selected[0];
            if (first) void applyWordBoundary("start", first);
          }}
          onSetEnd={() => {
            const selected = getSelectedWords();
            const last = selected[selected.length - 1];
            if (last) void applyWordBoundary("end", last);
          }}
          onRemoveSelected={() => void removeSelectedWords()}
          onCopyQuote={() => void copySelectedQuote()}
          onCreateClip={() => void createClipFromSelection(getSelectedWords())}
          onRemoveFillers={() => void markRemoveRanges(fillerMatches, "fillers")}
          onRemovePauses={() => void markRemoveRanges(pauseMatches, "pauses")}
          onResetOperations={() => void resetEditOperations()}
          onCreateClipFromSearch={(startWordIndex, endWordIndex) => {
            const words = parsedTranscript.words.filter(
              (word) => word.index >= startWordIndex && word.index <= endWordIndex,
            );
            void createClipFromSelection(words);
          }}
        />
      )}

      {showAdvancedTranscript && (
        <details className="rounded-xl border border-border/40 bg-background/55 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Advanced transcript mode
          </summary>
          <div className="mt-3">
            <WordLevelTranscriptPanel
              precision={transcriptPrecision}
              words={clipWords}
              segments={clipSegments}
              selectedRange={selectedWordRange}
              activeWordIndex={activeWord?.index ?? null}
              fillerCount={fillerMatches.length}
              pauseCount={pauseMatches.length}
              operationCount={editOperations.length}
              isBusy={operationLoading || Boolean(isGenerating)}
              searchQuery={fullTranscriptSearchQuery}
              searchResults={fullTranscriptSearchResults}
              onSearchChange={setFullTranscriptSearchQuery}
              onWordClick={(word, event) => {
                selectWord(word, event.shiftKey);
                remotionPreviewRef.current?.seekToMs(Math.max(0, word.startMs - startMs));
                handlePreviewTimeUpdate(Math.max(0, word.startMs - startMs));
              }}
              onClearSelection={() => setSelectedWordRange(null)}
              onSetStart={() => {
                const selected = getSelectedWords();
                const first = selected[0];
                if (first) void applyWordBoundary("start", first);
              }}
              onSetEnd={() => {
                const selected = getSelectedWords();
                const last = selected[selected.length - 1];
                if (last) void applyWordBoundary("end", last);
              }}
              onRemoveSelected={() => void removeSelectedWords()}
              onCopyQuote={() => void copySelectedQuote()}
              onCreateClip={() => void createClipFromSelection(getSelectedWords())}
              onRemoveFillers={() => void markRemoveRanges(fillerMatches, "fillers")}
              onRemovePauses={() => void markRemoveRanges(pauseMatches, "pauses")}
              onResetOperations={() => void resetEditOperations()}
              onCreateClipFromSearch={(startWordIndex, endWordIndex) => {
                const words = parsedTranscript.words.filter(
                  (word) => word.index >= startWordIndex && word.index <= endWordIndex,
                );
                void createClipFromSelection(words);
              }}
            />
          </div>
        </details>
      )}

      {captionQuality.tier === "needs_cleanup" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Some transcript cues may be noisy ({captionQuality.validCount}/{captionQuality.totalCount} usable). Edit below or regenerate.</span>
        </div>
      )}

      {showCaptionTools && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Caption controls</p>
              <p className="text-[11px] text-muted-foreground/55">
                Edit subtitle text and clean cues. Styling lives in the Style tab.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Subtitle preview
              <Switch
                checked={subtitlesPreviewEnabled}
                onCheckedChange={setSubtitlesPreviewEnabled}
                aria-label="Toggle subtitle preview"
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-xl border border-border/40 bg-muted/15 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold text-foreground">Caption assist</p>
              <p className="text-[11px] text-muted-foreground/55">
                Improve text while keeping cue timing unchanged.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={operationLoading}
                onClick={() => void runCaptionAssist("cleanup", { mode: "cleanup" })}
              >
                Clean
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={operationLoading}
                onClick={() => void runCaptionAssist("cleanup", { mode: "simplify" })}
              >
                Simplify
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={operationLoading}
                onClick={() => void runCaptionAssist("cleanup", { mode: "add_emojis" })}
              >
                Emojis
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={operationLoading}
                onClick={() => void runCaptionAssist("highlight-keywords")}
              >
                Keywords
              </Button>
              <select
                value={captionTranslateLanguage}
                onChange={(event) => setCaptionTranslateLanguage(event.target.value)}
                className="h-7 rounded-md border border-border/50 bg-background px-2 text-[11px]"
              >
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
              </select>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={operationLoading}
                onClick={() =>
                  void runCaptionAssist("translate", { language: captionTranslateLanguage })
                }
              >
                Translate
              </Button>
            </div>
          </div>
        </>
      )}

      {showSegmentEditor && (
        <>
      {/* Transcript toolbar: search + segment count + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-full rounded-lg border border-border/50 bg-muted/20 pl-8 pr-3 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Segment count badge */}
        <span className="text-[10px] font-medium text-muted-foreground/50 shrink-0">
          {displayEntries.length}
          {searchQuery.trim() ? `/${entries.length}` : ""} segment{entries.length !== 1 ? "s" : ""}
        </span>
        {entries.length === 1 ? (
          <Badge variant="outline" className="border-border/40 bg-muted/30 text-[10px] text-muted-foreground">
            Single segment
          </Badge>
        ) : null}

        {hasChanges ? (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-300">
            Unsaved caption changes
          </Badge>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onGenerateCaptions && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground" onClick={onGenerateCaptions} disabled={isGenerating}>
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Regen
            </Button>
          )}
          {hasChanges && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground" onClick={handleUndo}>
              Undo
            </Button>
          )}
          <Button size="sm" className="h-6 gap-1 px-2.5 text-[11px]" onClick={handleSave} disabled={!hasChanges || isSaving || isGenerating}>
            <Save className="h-3 w-3" />
            {isSaving ? "Saving…" : isGenerating ? "Refreshing…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Video position bar */}
      {previewPath && entries.length > 0 && (
        <div className="h-0.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${videoProgress}%` }} />
        </div>
      )}

      {/* Per-segment rows */}
      <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/30 divide-y divide-border/25">
        {displayEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground/40">
            {searchQuery.trim() ? "No segments match your search." : "No segments available."}
          </div>
        ) : (
          displayEntries.map(({ entry, idx }) => (
            <SegmentRow
              key={`${undoKey}-${entry.index}`}
              entry={entry}
              originalIndex={idx}
              isLast={idx === entries.length - 1}
              isActive={currentMs >= entry.startMs && currentMs < entry.endMs}
              onTextChange={updateEntryText}
              onTimingChange={adjustEntryTiming}
              onSplit={splitEntry}
              onMerge={mergeWithNext}
              onHide={hideEntry}
              onSeek={(ms) => {
                remotionPreviewRef.current?.seekToMs(ms);
                handlePreviewTimeUpdate(ms);
              }}
            />
          ))
        )}
      </div>
        </>
      )}

      {showStyleStudio && (
        <>
          {mode === "style" && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
              <p className="text-sm font-semibold text-violet-100">Choose a caption look</p>
              <p className="mt-1 text-xs leading-5 text-violet-100/70">
                Start with a preset. Open Customize style only when you need deeper controls.
              </p>
            </div>
          )}
          <CaptionOverlayStudio
            value={safeCaptionStyle}
            onChange={handleCaptionStyleChange}
            sampleCaption={entries[0]?.text}
            previewPath={previewPath}
            captionEntries={entries}
            selectedClipCount={selectedClipCount}
            onApplyToSelected={onApplyCaptionStyleToSelected}
            presetFirst={mode === "style"}
          />
          {mode === "style" && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground/65">
                {hasStyleChanges ? "Caption style has unsaved changes." : "Caption style is saved."}
              </p>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={handleSave}
                disabled={!hasStyleChanges || isSaving || isGenerating}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save style"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Per-segment row ────────────────────────────────────────────────────────────

function msToMinSec(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function WordLevelTranscriptPanel({
  precision,
  words,
  segments,
  selectedRange,
  activeWordIndex,
  fillerCount,
  pauseCount,
  operationCount,
  isBusy,
  searchQuery,
  searchResults,
  onSearchChange,
  onWordClick,
  onClearSelection,
  onSetStart,
  onSetEnd,
  onRemoveSelected,
  onCopyQuote,
  onCreateClip,
  onRemoveFillers,
  onRemovePauses,
  onResetOperations,
  onCreateClipFromSearch,
}: {
  precision: ReturnType<typeof getTranscriptPrecision>;
  words: TranscriptUiWord[];
  segments: ReturnType<typeof getClipSegments>;
  selectedRange: { startIndex: number; endIndex: number } | null;
  activeWordIndex: number | null;
  fillerCount: number;
  pauseCount: number;
  operationCount: number;
  isBusy: boolean;
  searchQuery: string;
  searchResults: ReturnType<typeof searchTranscript>;
  onSearchChange: (value: string) => void;
  onWordClick: (word: TranscriptUiWord, event: { shiftKey: boolean }) => void;
  onClearSelection: () => void;
  onSetStart: () => void;
  onSetEnd: () => void;
  onRemoveSelected: () => void;
  onCopyQuote: () => void;
  onCreateClip: () => void;
  onRemoveFillers: () => void;
  onRemovePauses: () => void;
  onResetOperations: () => void;
  onCreateClipFromSearch: (startWordIndex: number, endWordIndex: number) => void;
}) {
  const selectedMin = selectedRange
    ? Math.min(selectedRange.startIndex, selectedRange.endIndex)
    : null;
  const selectedMax = selectedRange
    ? Math.max(selectedRange.startIndex, selectedRange.endIndex)
    : null;
  const selectedCount =
    selectedMin == null || selectedMax == null
      ? 0
      : words.filter((word) => word.index >= selectedMin && word.index <= selectedMax).length;
  const hasWordTiming = precision === "word" && words.length > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-background/65">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/35 px-3 py-2.5">
        <div>
          <p className="text-xs font-semibold text-foreground">Transcript word editor</p>
          <p className="text-[11px] text-muted-foreground/60">
            {hasWordTiming
              ? "Click a word to seek, Shift-click to select a range, then apply precise local edits."
              : "Word-level timing unavailable. Re-transcribe for precise editing."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Badge variant="outline" className="border-border/50 bg-muted/30 capitalize">
            {precision.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="border-border/50 bg-muted/30">
            {fillerCount} fillers
          </Badge>
          <Badge variant="outline" className="border-border/50 bg-muted/30">
            {pauseCount} pauses
          </Badge>
          <Badge variant="outline" className="border-border/50 bg-muted/30">
            {operationCount} edits
          </Badge>
        </div>
      </div>

      {!hasWordTiming ? (
        <div className="space-y-2 px-3 py-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Segment-level transcript mode is active. Word trim, filler removal, and pause removal are disabled until precise timings exist.</span>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border/30 bg-muted/20">
            {segments.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground/50">No timed transcript segments available.</p>
            ) : (
              segments.map((segment) => (
                <div key={segment.id} className="border-b border-border/20 px-3 py-2 last:border-b-0">
                  <p className="font-mono text-[10px] text-muted-foreground/50">
                    {msToMinSec(segment.startMs)} → {msToMinSec(segment.endMs)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/75">{segment.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSetStart}
              disabled={selectedCount === 0 || isBusy}
              className="h-7 rounded-lg border border-border/50 bg-muted/30 px-2.5 text-[11px] font-semibold text-foreground disabled:opacity-40"
            >
              Set start here
            </button>
            <button
              type="button"
              onClick={onSetEnd}
              disabled={selectedCount === 0 || isBusy}
              className="h-7 rounded-lg border border-border/50 bg-muted/30 px-2.5 text-[11px] font-semibold text-foreground disabled:opacity-40"
            >
              Set end here
            </button>
            <button
              type="button"
              onClick={onCreateClip}
              disabled={selectedCount === 0 || isBusy}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              New clip
            </button>
            <button
              type="button"
              onClick={onRemoveSelected}
              disabled={selectedCount === 0 || isBusy}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 text-[11px] font-semibold text-red-300 disabled:opacity-40"
            >
              <XCircle className="h-3 w-3" />
              Remove selected
            </button>
            <button
              type="button"
              onClick={onCopyQuote}
              disabled={selectedCount === 0 || isBusy}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-40"
            >
              <Copy className="h-3 w-3" />
              Copy quote
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0 || isBusy}
              className="h-7 rounded-lg border border-border/50 bg-background px-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto rounded-lg border border-border/30 bg-muted/15 px-3 py-3 text-sm leading-7">
            {words.map((word) => {
              const isSelected =
                selectedMin != null && selectedMax != null && word.index >= selectedMin && word.index <= selectedMax;
              const isActive = word.index === activeWordIndex;
              return (
                <button
                  key={`${word.index}-${word.startMs}`}
                  type="button"
                  onClick={(event) => onWordClick(word, event)}
                  className={cn(
                    "mr-1.5 rounded px-1.5 py-0.5 text-left transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "bg-primary/20 text-primary"
                        : "text-foreground/75 hover:bg-muted/60 hover:text-foreground",
                  )}
                  title={`${msToMinSec(word.startMs)} → ${msToMinSec(word.endMs)}`}
                >
                  {word.word}
                </button>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={onRemoveFillers}
              disabled={fillerCount === 0 || isBusy}
              className="rounded-lg border border-border/45 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground disabled:opacity-40"
            >
              Remove fillers
              <span className="block text-[11px] font-normal text-muted-foreground/60">
                Marks filler words for non-destructive removal during export.
              </span>
            </button>
            <button
              type="button"
              onClick={onRemovePauses}
              disabled={pauseCount === 0 || isBusy}
              className="rounded-lg border border-border/45 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground disabled:opacity-40"
            >
              Remove pauses
              <span className="block text-[11px] font-normal text-muted-foreground/60">
                Marks word gaps over 900ms for the export render plan.
              </span>
            </button>
          </div>

          <div className="rounded-lg border border-border/30 bg-muted/10 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <input
                type="search"
                placeholder="Search full transcript to create a new clip..."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-8 w-full rounded-lg border border-border/45 bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto divide-y divide-border/20 rounded-lg border border-border/25 bg-background/70">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    disabled={
                      result.wordStartIndex === undefined ||
                      result.wordEndIndex === undefined ||
                      isBusy
                    }
                    onClick={() => {
                      if (result.wordStartIndex !== undefined && result.wordEndIndex !== undefined) {
                        onCreateClipFromSearch(result.wordStartIndex, result.wordEndIndex);
                      }
                    }}
                    className="block w-full px-3 py-2 text-left text-xs text-foreground/75 hover:bg-muted/35 disabled:opacity-45"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      {result.startMs == null ? "untimed" : msToMinSec(result.startMs)}
                    </span>
                    <span className="ml-2">{result.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {operationCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
              <span>{operationCount} non-destructive edit operation{operationCount === 1 ? "" : "s"} saved. Video cuts apply during export rendering.</span>
              <button
                type="button"
                onClick={onResetOperations}
                disabled={isBusy}
                className="shrink-0 rounded border border-cyan-300/25 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
              >
                Reset edits
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentRow({
  entry,
  originalIndex,
  isLast,
  isActive,
  onTextChange,
  onTimingChange,
  onSplit,
  onMerge,
  onHide,
  onSeek,
}: {
  entry: CaptionEntry;
  originalIndex: number;
  isLast: boolean;
  isActive: boolean;
  onTextChange: (idx: number, text: string) => void;
  onTimingChange: (idx: number, key: "startMs" | "endMs", value: number) => void;
  onSplit: (idx: number) => void;
  onMerge: (idx: number) => void;
  onHide: (idx: number) => void;
  onSeek: (ms: number) => void;
}) {
  const canSplit = entry.text.trim().split(/\s+/).filter(Boolean).length > 1;

  return (
    <div className={cn(
      "group flex items-start gap-3 px-4 py-2.5 transition-colors",
      isActive ? "bg-primary/8" : "hover:bg-muted/20"
    )}>
      {/* Timestamp — click to seek */}
      <button
        onClick={() => onSeek(entry.startMs)}
        className={cn(
          "shrink-0 w-[92px] pt-0.5 font-mono text-[10px] tabular-nums text-left transition-colors hover:text-primary",
          isActive ? "text-primary font-semibold" : "text-muted-foreground/50"
        )}
        title="Seek to this segment"
      >
        {msToMinSec(entry.startMs)} → {msToMinSec(entry.endMs)}
      </button>

      <div className="grid w-[88px] shrink-0 gap-1">
        <input
          type="number"
          value={entry.startMs}
          min={0}
          step={50}
          onChange={(event) => onTimingChange(originalIndex, "startMs", Number(event.target.value))}
          className="h-6 rounded border border-border/40 bg-background px-1.5 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary/50"
          title="Cue start milliseconds"
        />
        <input
          type="number"
          value={entry.endMs}
          min={entry.startMs + 1}
          step={50}
          onChange={(event) => onTimingChange(originalIndex, "endMs", Number(event.target.value))}
          className="h-6 rounded border border-border/40 bg-background px-1.5 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary/50"
          title="Cue end milliseconds"
        />
      </div>

      {/* Editable text */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onTextChange(originalIndex, e.currentTarget.textContent ?? "")}
        className="flex-1 min-w-0 text-sm leading-relaxed text-foreground/80 outline-none focus:text-foreground cursor-text py-0.5"
      >
        {entry.text}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button
          onClick={() => onSplit(originalIndex)}
          disabled={!canSplit}
          title="Split at midpoint"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-20 disabled:pointer-events-none"
        >
          <Scissors className="h-3 w-3" />
        </button>
        {!isLast && (
          <button
            onClick={() => onMerge(originalIndex)}
            title="Merge with next segment"
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors text-[11px] font-bold"
          >
            ↓
          </button>
        )}
        <button
          onClick={() => onHide(originalIndex)}
          title="Hide this cue"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
}
