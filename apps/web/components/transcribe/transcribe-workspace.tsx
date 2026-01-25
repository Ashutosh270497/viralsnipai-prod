"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Volume2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

type Mode = "youtube" | "upload";
type Status = "idle" | "processing" | "completed" | "error";
type TtsStatus = "idle" | "processing" | "completed" | "error";

type TranscriptSegment = {
  timestamp: string;
  speaker: string;
  text: string;
};

type TranscriptionJob = {
  id: string;
  status: string;
  sourceType: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  title: string | null;
  transcript: string | null;
  segments: TranscriptSegment[];
  durationSec: number | null;
  createdAt: string;
};

const TTS_VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "verse", label: "Verse" },
  { value: "blossom", label: "Blossom" },
  { value: "ballad", label: "Ballad" },
  { value: "coral", label: "Coral" },
  { value: "nova", label: "Nova" },
  { value: "sage", label: "Sage" },
  { value: "ash", label: "Ash" },
  { value: "echo", label: "Echo" },
  { value: "onyx", label: "Onyx" },
  { value: "shimmer", label: "Shimmer" },
  { value: "fable", label: "Fable" }
] as const;

const TTS_FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
  { value: "ogg", label: "OGG" },
  { value: "flac", label: "FLAC" }
] as const;

export function TranscribeWorkspace({ userName }: { userName: string }) {
  const [mode, setMode] = useState<Mode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState<(typeof TTS_VOICES)[number]["value"]>(TTS_VOICES[0].value);
  const [ttsFormat, setTtsFormat] = useState<(typeof TTS_FORMATS)[number]["value"]>(TTS_FORMATS[0].value);
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsSize, setTtsSize] = useState<number | null>(null);
  const canGenerateSpeech = ttsText.trim().length >= 3;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (status === "processing") {
      interval = setInterval(() => {
        setProgress((value) => {
          if (value >= 95) {
            return value;
          }
          return value + 5;
        });
      }, 300);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status]);

  const filteredSegments = useMemo(() => {
    if (segments.length === 0) {
      return [];
    }
    if (!searchTerm.trim()) {
      return segments;
    }
    const query = searchTerm.toLowerCase();
    return segments.filter((segment) => segment.text.toLowerCase().includes(query));
  }, [segments, searchTerm]);

  function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
    setYoutubeUrl(event.target.value);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
  }

  function resetState() {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setTranscript(null);
    setSegments([]);
    setJob(null);
  }

  function validate(): string | null {
    if (mode === "youtube") {
      if (!youtubeUrl.trim()) {
        return "Enter a YouTube URL to continue.";
      }
      const isValid = youtubeUrl.startsWith("http://") || youtubeUrl.startsWith("https://");
      return isValid ? null : "Please provide a valid URL.";
    }

    if (!selectedFile) {
      return "Choose a video or audio file to transcribe.";
    }
    const supported = ["video", "audio"].some((prefix) => selectedFile.type.startsWith(prefix));
    if (!supported) {
      return "Unsupported file type. Upload video or audio.";
    }
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    void runTranscription();
  }

  async function runTranscription() {
    setStatus("processing");
    setProgress(12);
    setError(null);
    trackEvent({ name: "transcribe_submit", payload: { mode } });

    try {
      let response: Response;

      if (mode === "youtube") {
        response = await fetch("/api/transcribe/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "youtube", url: youtubeUrl })
        });
      } else {
        if (!selectedFile) {
          throw new Error("Choose a file to transcribe.");
        }
        const formData = new FormData();
        formData.append("mode", "upload");
        formData.append("file", selectedFile);
        formData.append("title", selectedFile.name);
        response = await fetch("/api/transcribe/jobs", {
          method: "POST",
          body: formData
        });
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.error?.message === "string"
              ? payload.error.message
              : "Unable to transcribe. Try again.";
        throw new Error(message);
      }

      const data = await response.json();
      const jobPayload = data.job as TranscriptionJob | undefined;
      if (!jobPayload) {
        throw new Error("Unexpected response from transcription service.");
      }

      setJob(jobPayload);
      setTranscript(jobPayload.transcript ?? "");
      setSegments(jobPayload.segments ?? []);
      setProgress(100);
      setStatus("completed");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to transcribe.";
      setError(message);
      setStatus("error");
    }
  }

  async function copyTranscript() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      trackEvent({ name: "transcribe_copy" });
    } catch (err) {
      console.error("Failed to copy transcript", err);
    }
  }

  async function downloadTranscript() {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = job?.title ? `${job.title.replace(/\s+/g, "-").toLowerCase()}-transcript.txt` : "transcript.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    trackEvent({ name: "transcribe_download" });
  }

  async function copySegments() {
    if (segments.length === 0) {
      return;
    }
    const lines = segments.map((segment) => `${segment.timestamp} ${segment.speaker}: ${segment.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      trackEvent({ name: "transcribe_copy_segments" });
    } catch (err) {
      console.error("Failed to copy segments", err);
    }
  }

  async function handleGenerateSpeech() {
    if (!canGenerateSpeech) {
      setTtsError("Enter text to convert into speech.");
      return;
    }

    setTtsStatus("processing");
    setTtsError(null);
    setTtsAudioUrl(null);
    setTtsSize(null);

    try {
      trackEvent({ name: "transcribe_tts_generate", payload: { voice: ttsVoice, format: ttsFormat } });
      const response = await fetch("/api/transcribe/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          text: ttsText.trim(),
          voice: ttsVoice,
          format: ttsFormat
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to generate speech. Try again in a moment.";
        throw new Error(message);
      }

      if (!payload?.audioUrl) {
        throw new Error("Text-to-speech succeeded but no audio file was returned.");
      }

      setTtsAudioUrl(payload.audioUrl as string);
      setTtsSize(typeof payload.size === "number" ? payload.size : null);
      setTtsStatus("completed");
    } catch (err) {
      console.error("Text-to-speech generation failed", err);
      setTtsError(err instanceof Error ? err.message : "Unable to generate speech. Try again later.");
      setTtsStatus("error");
    }
  }

  function resetTts() {
    setTtsStatus("idle");
    setTtsError(null);
    setTtsAudioUrl(null);
    setTtsSize(null);
    setTtsText("");
  }

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Transcribe</h1>
            <p className="text-sm font-medium text-muted-foreground/80">AI-powered audio transcription</p>
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Transcribe</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              Paste a YouTube link or upload a file. AI extracts the transcript so {userName} can edit and share faster.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs defaultValue="youtube" onValueChange={(value) => setMode(value as Mode)}>
              <TabsList aria-label="Transcription source" className="rounded-xl">
                <TabsTrigger value="youtube" className="rounded-lg">YouTube URL</TabsTrigger>
                <TabsTrigger value="upload" className="rounded-lg">Upload file</TabsTrigger>
              </TabsList>
              <TabsContent value="youtube" asChild>
                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  <div className="space-y-2.5">
                    <Label htmlFor="youtube-url" className="text-sm font-semibold tracking-tight">YouTube link</Label>
                    <Input
                      id="youtube-url"
                      type="url"
                      inputMode="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={handleUrlChange}
                      autoComplete="off"
                      className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
                    />
                  </div>
                  <ActionBar status={status} progress={progress} error={error} job={job} onReset={resetState} />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="submit"
                      disabled={status === "processing"}
                      className="h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
                    >
                      {status === "processing" ? "Transcribing..." : "Generate transcript"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetState}
                      disabled={status === "processing"}
                      className="h-10 rounded-xl"
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="upload" asChild>
                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  <div className="space-y-2.5">
                    <Label htmlFor="upload-input" className="text-sm font-semibold tracking-tight">Upload video or audio</Label>
                    <div className="rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 px-4 py-6 text-center text-sm transition-colors hover:border-violet-300 dark:hover:border-violet-700">
                      <p className="mb-3 font-semibold text-foreground">Drag & drop or browse</p>
                      <Input
                        id="upload-input"
                        type="file"
                        accept="video/*,audio/*"
                        onChange={handleFileChange}
                        className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-700 hover:file:bg-violet-200 dark:file:bg-violet-950 dark:file:text-violet-300"
                      />
                      {selectedFile ? (
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                          Selected: {selectedFile.name} • {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground/80">Supported formats: MP4, MOV, MKV, MP3, WAV</p>
                      )}
                    </div>
                  </div>
                  <ActionBar status={status} progress={progress} error={error} job={job} onReset={resetState} />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="submit"
                      disabled={status === "processing"}
                      className="h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
                    >
                      {status === "processing" ? "Transcribing..." : "Generate transcript"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetState}
                      disabled={status === "processing"}
                      className="h-10 rounded-xl"
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
        </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl" aria-live="polite">
        <CardHeader>
          <CardTitle className="tracking-tight">Transcript preview</CardTitle>
          <CardDescription className="text-muted-foreground/80">Search, copy, or download once transcription finishes.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Search transcript..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search transcript"
              disabled={!transcript}
              className="h-9 rounded-xl border-border/50 bg-background/50 text-sm transition-colors focus:border-violet-300 focus:ring-violet-200"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyTranscript}
                disabled={!transcript}
                className="h-8 rounded-lg text-xs"
              >
                Copy text
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadTranscript}
                disabled={!transcript}
                className="h-8 rounded-lg text-xs"
              >
                Download .txt
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copySegments}
                disabled={segments.length === 0}
                className="h-8 rounded-lg text-xs"
              >
                Copy segments
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-background">
            {status === "idle" && !transcript ? (
              <EmptyState>
                <p className="text-sm text-muted-foreground">
                  Start by submitting a YouTube link or uploading a file to view the transcript.
                </p>
              </EmptyState>
            ) : null}
            {status === "processing" ? <ProcessingState progress={progress} /> : null}
            {status === "completed" && transcript ? (
              <div className="h-full overflow-y-auto p-4">
                <div className="space-y-3 text-sm text-muted-foreground">
                  {filteredSegments.map((segment) => (
                    <motion.div
                      key={`${segment.timestamp}-${segment.speaker}-${segment.text.slice(0, 8)}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Badge variant="outline" className="mb-1 text-[10px]">
                        {segment.timestamp}
                      </Badge>
                      <p className="font-semibold text-foreground">{segment.speaker}</p>
                      <p>{segment.text}</p>
                    </motion.div>
                  ))}
                  {segments.length > 0 && filteredSegments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No lines match “{searchTerm}”.</p>
                  ) : null}
                  {segments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Structured segments are not available. Use the raw transcript below.
                    </p>
                  ) : null}
                </div>
                <details className="mt-6 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">View raw transcript</summary>
                  <Textarea className="mt-3 h-40" value={transcript} readOnly />
                </details>
              </div>
            ) : null}
            {status === "error" && error ? (
              <EmptyState>
                <p className="text-sm text-destructive">{error}</p>
              </EmptyState>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </section>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Text to Speech</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Turn scripts or summaries into natural audio clips. Generated voices use OpenAI text-to-speech under the hood.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={ttsText}
            onChange={(event) => setTtsText(event.target.value)}
            placeholder="Paste or write the narration you want to convert into speech..."
            rows={4}
            className="rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
          />
          <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Voice</Label>
                <Select value={ttsVoice} onValueChange={(value) => setTtsVoice(value as (typeof TTS_VOICES)[number]["value"])}>
                  <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/80 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_VOICES.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Format</Label>
                <Select value={ttsFormat} onValueChange={(value) => setTtsFormat(value as (typeof TTS_FORMATS)[number]["value"])}>
                  <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/80 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {ttsError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {ttsError}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleGenerateSpeech}
              disabled={ttsStatus === "processing" || !canGenerateSpeech}
              className="h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
            >
              {ttsStatus === "processing" ? (
                "Generating speech…"
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" aria-hidden /> Generate speech
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={resetTts}
              disabled={ttsStatus === "processing" && !ttsAudioUrl}
              className="h-10 rounded-xl"
            >
              Clear
            </Button>
            {ttsAudioUrl ? (
              <Button variant="outline" asChild className="h-10 rounded-xl">
                <a href={ttsAudioUrl} download>
                  <Download className="mr-2 h-4 w-4" aria-hidden /> Download
                </a>
              </Button>
            ) : null}
          </div>
          {ttsStatus === "processing" ? (
            <div className="space-y-2 rounded-xl border border-violet-200/40 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/30 p-4 shadow-sm">
              <Progress value={65} aria-label="Speech generation progress" className="h-1.5" />
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Synthesizing voice…</p>
            </div>
          ) : null}
          {ttsAudioUrl ? (
            <div className="space-y-2 rounded-2xl border border-border/40 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-4 shadow-sm">
              <audio controls src={ttsAudioUrl} className="w-full" />
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground/80">
                <span>{ttsVoice} voice</span>
                <span>•</span>
                <span>{ttsFormat.toUpperCase()}</span>
                {typeof ttsSize === "number" ? (
                  <>
                    <span>•</span>
                    <span>{(ttsSize / 1024).toFixed(1)} KB</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionBar({
  status,
  progress,
  error,
  job,
  onReset
}: {
  status: Status;
  progress: number;
  error: string | null;
  job?: TranscriptionJob | null;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      {status === "processing" ? (
        <div className="space-y-2 rounded-xl border border-violet-200/40 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/30 p-3 shadow-sm">
          <Progress value={progress} aria-label="Transcription progress" className="h-1.5" />
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Processing audio and generating transcript…</p>
        </div>
      ) : null}
      {status === "completed" && job ? (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 dark:bg-violet-950/30 px-3 py-2 text-xs shadow-sm">
          <p className="font-semibold text-violet-700 dark:text-violet-300">Transcript ready.</p>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-violet-600/80 dark:text-violet-400/80">
            {job.durationSec ? <span>Duration · {formatDuration(job.durationSec * 1000)}</span> : null}
            {job.sourceType === "youtube" && job.sourceUrl ? (
              <span>
                YouTube · <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">View source</a>
              </span>
            ) : null}
            {job.sourceType === "upload" && job.title ? <span>File · {job.title}</span> : null}
          </div>
        </div>
      ) : null}
      {error && status !== "processing" ? (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 rounded-lg">
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-medium text-foreground">No transcript yet</p>
      {children}
    </div>
  );
}

function ProcessingState({ progress }: { progress: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <motion.div
        className="h-12 w-12 rounded-full border-4 border-brand-500/40 border-t-brand-500"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
      />
      <p className="text-sm text-muted-foreground">Transcribing… {Math.min(progress, 100)}%</p>
    </div>
  );
}
