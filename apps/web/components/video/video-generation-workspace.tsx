"use client";

import { useState } from "react";
import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type GeneratedVideo = {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
};

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 • YouTube" },
  { value: "9:16", label: "9:16 • TikTok/Shorts" },
  { value: "1:1", label: "1:1 • Square" },
  { value: "4:5", label: "4:5 • Instagram" }
];

export function VideoGenerationWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedVideo[]>([]);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Please describe the scene you want Sora to create.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const body = new FormData();
      body.append("prompt", prompt.trim());
      body.append("aspectRatio", aspectRatio);
      body.append("durationSeconds", String(duration));
      if (referenceImage) {
        body.append("referenceImage", referenceImage);
      }
      if (referenceVideo) {
        body.append("referenceVideo", referenceVideo);
      }

      const response = await fetch("/api/sora", {
        method: "POST",
        body,
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unable to generate video." }));
        throw new Error(payload.error ?? "Unable to generate video.");
      }

      const payload = (await response.json()) as { video: GeneratedVideo };
      setResults((current) => [payload.video, ...current]);
      setPrompt("");
      setReferenceImage(null);
      setReferenceVideo(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-orange-500/90 via-amber-500/90 to-yellow-500/90 p-4 shadow-sm">
            <Film className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">AI Video Generator</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Powered by OpenAI Sora</p>
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Describe your scene</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              Craft a text prompt and optionally upload reference imagery. Sora-2 will generate a cinematic clip that fits your brand.
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="sora-prompt" className="text-sm font-semibold tracking-tight">Prompt</Label>
            <Textarea
              id="sora-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Close-up of a creator speaking to camera in a neon-lit studio, shallow depth of field, energetic tone"
              rows={5}
              className="rounded-xl border-border/50 bg-background/50 transition-colors focus:border-orange-300 focus:ring-orange-200"
            />
          </div>
          <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sora-aspect" className="text-xs font-semibold uppercase tracking-wide">Aspect ratio</Label>
                <select
                  id="sora-aspect"
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border/50 bg-background/80 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                >
                  {ASPECT_RATIOS.map((ratio) => (
                    <option key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Duration (seconds)</Label>
                <Input
                  type="number"
                  min={4}
                  max={60}
                  value={duration}
                  onChange={(event) => setDuration(Number.parseInt(event.target.value || "10", 10))}
                  className="h-10 rounded-xl border-border/50 bg-background/80 transition-colors focus:border-orange-300 focus:ring-orange-200"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReferenceUpload
              label="Reference image (optional)"
              accept="image/*"
              file={referenceImage}
              onFileChange={setReferenceImage}
            />
            <ReferenceUpload
              label="Reference video (optional)"
              accept="video/mp4,video/webm"
              file={referenceVideo}
              onFileChange={setReferenceVideo}
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:from-orange-700 hover:via-amber-700 hover:to-yellow-700 shadow-md hover:shadow-lg transition-all"
          >
            {loading ? "Generating…" : "Generate video"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Recent videos</CardTitle>
          <CardDescription className="text-muted-foreground/80">Generated clips appear here. Download or rerun with a new prompt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {results.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-12 text-center">
              <div className="flex flex-col items-center gap-6 max-w-md">
                <div className="rounded-full bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 p-6">
                  <Film className="h-12 w-12 text-muted-foreground/70" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">No videos yet</p>
                  <p className="text-xs text-muted-foreground/80">Describe your scene and Sora will create something cinematic</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 shadow-sm hover:shadow-md transition-all">
                  <video controls className="w-full" poster={video.thumbnailUrl}>
                    <source src={video.videoUrl} type="video/mp4" />
                  </video>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground/80">
                      <span>{new Date(video.createdAt).toLocaleString()}</span>
                      <Badge className="text-[10px] px-2 py-0.5 rounded-full">~{video.duration}s</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{video.prompt}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <a
                        href={video.videoUrl}
                        download
                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-semibold hover:underline"
                      >
                        Download MP4
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
    </div>
  );
}

function ReferenceUpload({
  label,
  accept,
  file,
  onFileChange
}: {
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide">{label}</Label>
      <div className="rounded-xl border-2 border-dashed border-border/50 bg-gradient-to-br from-orange-50/40 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/10 p-3 transition-colors hover:border-orange-300 dark:hover:border-orange-700">
        <Input
          type="file"
          accept={accept}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            onFileChange(selected ?? null);
          }}
          className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-700 hover:file:bg-orange-200 dark:file:bg-orange-950 dark:file:text-orange-300"
        />
      </div>
      {file ? <p className="text-xs text-muted-foreground/80">{file.name}</p> : null}
    </div>
  );
}
