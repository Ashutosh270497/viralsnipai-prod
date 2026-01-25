"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import { useVoicer } from "./use-voicer";

export function VoicerWorkspace() {
  const {
    voices,
    isLoading,
    isCreating,
    generatingVoiceId,
    drafts,
    createVoice,
    generateSpeech,
    updateDraft
  } = useVoicer();
  const { toast } = useToast();

  const [voiceName, setVoiceName] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [sampleFile, setSampleFile] = useState<File | null>(null);

  const handleVoiceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sampleFile) {
      toast({
        variant: "destructive",
        title: "Add a sample clip",
        description: "Upload 1-3 sentences of clear speech so we can clone the voice."
      });
      return;
    }
    if (voiceName.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Name the voice",
        description: "Use at least three characters so you can recognise the clone later."
      });
      return;
    }

    await createVoice({
      name: voiceName,
      description: voiceDescription,
      file: sampleFile
    });
    setVoiceName("");
    setVoiceDescription("");
    setSampleFile(null);
    (event.currentTarget as HTMLFormElement).reset();
  };

  const handleSpeechSubmit = async (event: React.FormEvent<HTMLFormElement>, voiceId: string) => {
    event.preventDefault();
    const text = drafts[voiceId] ?? "";
    await generateSpeech({ voiceId, text });
  };

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Voice Cloning Studio</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Powered by ElevenLabs AI</p>
          </div>
        </div>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground/90">
          Create ultra-realistic voice clones from short audio samples. Generate natural-sounding narration for your content in minutes.
        </p>
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader className="space-y-2 pb-5">
          <CardTitle className="text-lg font-semibold tracking-tight">Clone a new voice</CardTitle>
          <CardDescription className="text-sm">
            Upload a short, high-quality clip (10MB max). We&apos;ll use ElevenLabs to create a reusable voice for
            synthetic narration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 md:grid-cols-[minmax(0,400px)_minmax(0,1fr)]" onSubmit={handleVoiceSubmit}>
            <div className="space-y-5">
              <div className="space-y-2.5">
                <Label htmlFor="voice-name" className="text-sm font-semibold tracking-tight">Voice name</Label>
                <Input
                  id="voice-name"
                  value={voiceName}
                  onChange={(event) => setVoiceName(event.target.value)}
                  placeholder="Ex: Ada energetic"
                  required
                  className="h-11 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="voice-description" className="text-sm font-semibold tracking-tight">Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="voice-description"
                  value={voiceDescription}
                  onChange={(event) => setVoiceDescription(event.target.value)}
                  placeholder="Describe the speaker, tone, or when to use this voice."
                  rows={4}
                  className="resize-none rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="voice-sample" className="text-sm font-semibold tracking-tight">Reference audio</Label>
                <div className="rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 p-4 text-center transition-colors hover:border-violet-300 dark:hover:border-violet-700">
                  <Input
                    id="voice-sample"
                    type="file"
                    accept="audio/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSampleFile(file ?? null);
                    }}
                    required
                    className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-violet-700 hover:file:bg-violet-200 dark:file:bg-violet-950 dark:file:text-violet-300"
                  />
                  {sampleFile && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Selected: {sampleFile.name}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Use 10–30 seconds of clear speech. Supported: MP3, WAV, M4A.
                </p>
              </div>
              <Button
                type="submit"
                disabled={isCreating}
                className="w-full h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
              >
                {isCreating ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Cloning voice…
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Clone voice
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:to-purple-950/20 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-violet-500/10 p-2">
                  <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm font-semibold tracking-tight text-foreground">Tips for realistic clones</p>
                  <ul className="space-y-2 text-sm text-muted-foreground/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-violet-500" />
                      <span>Record in a quiet space with consistent mic distance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-violet-500" />
                      <span>Include expressive moments (questions, emphasis) for richer tone.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-violet-500" />
                      <span>Mention how you want the voice used (shorts narration, ads, onboarding, etc.).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader className="space-y-2 pb-5">
          <CardTitle className="text-lg font-semibold tracking-tight">Your cloned voices</CardTitle>
          <CardDescription className="text-sm">
            Generate scripts, listen to previews, and reuse voices across projects. Recent renders stay attached to
            each voice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 p-8">
              <svg className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium text-muted-foreground">Loading voices…</p>
            </div>
          ) : voices.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-12 text-center">
              <div className="flex flex-col items-center gap-6 max-w-md">
                <div className="rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-8">
                  <svg className="h-12 w-12 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">No cloned voices yet</h3>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">
                    Create your first voice clone above to start generating high-converting narration for your content.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            voices.map((voice) => (
              <div
                key={voice.id}
                className="rounded-2xl border border-border/40 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-gradient-to-br from-violet-500 to-purple-600 p-2">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">{voice.name}</h3>
                    </div>
                    {voice.description ? (
                      <p className="text-sm text-muted-foreground/80 pl-11">{voice.description}</p>
                    ) : null}
                    <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground/70">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDistanceToNow(new Date(voice.createdAt), { addSuffix: true })}
                      </span>
                      <span className="font-mono text-foreground/80">ID: {voice.providerVoiceId.slice(0, 8)}...</span>
                    </div>
                  </div>
                  {voice.sampleUrl ? (
                    <div className="rounded-xl border border-border/40 bg-white/50 p-3 shadow-sm dark:bg-black/20">
                      <audio
                        controls
                        className="w-full md:w-64"
                        src={voice.sampleUrl}
                        aria-label={`Sample audio for ${voice.name}`}
                        style={{
                          height: '32px',
                          filter: 'sepia(20%) saturate(200%) hue-rotate(290deg)'
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <Separator className="my-6" />

                <form className="space-y-4" onSubmit={(event) => handleSpeechSubmit(event, voice.id)}>
                  <div className="space-y-2.5">
                    <Label htmlFor={`voicer-text-${voice.id}`} className="text-sm font-semibold tracking-tight">Script to narrate</Label>
                    <Textarea
                      id={`voicer-text-${voice.id}`}
                      rows={4}
                      value={drafts[voice.id] ?? ""}
                      onChange={(event) => updateDraft(voice.id, event.target.value)}
                      placeholder="Paste the message you want narrated…"
                      className="resize-none rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground/70">
                      {(drafts[voice.id] ?? "").length} / 600 characters
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={generatingVoiceId === voice.id}
                      className="h-9 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-sm"
                    >
                      {generatingVoiceId === voice.id ? (
                        <>
                          <svg className="mr-2 h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <svg className="mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Generate speech
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {voice.renders.length > 0 ? (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <p className="text-sm font-semibold tracking-tight text-foreground">Recent renders</p>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        {voice.renders.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {voice.renders.map((render) => (
                        <div
                          key={render.id}
                          className="rounded-xl border border-violet-200/40 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:border-violet-900/30 dark:from-violet-950/20 dark:to-purple-950/10 p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex-1 space-y-2">
                              <p className="line-clamp-2 text-sm text-foreground leading-relaxed">{render.text}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                                <span className="inline-flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDistanceToNow(new Date(render.createdAt), { addSuffix: true })}
                                </span>
                                {render.durationSec ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    </svg>
                                    {render.durationSec}s
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border/40 bg-white/50 p-3 shadow-sm dark:bg-black/20">
                              <audio
                                controls
                                className="w-full md:w-64"
                                src={render.audioUrl}
                                aria-label={`Generated narration on ${render.createdAt}`}
                                style={{
                                  height: '32px',
                                  filter: 'sepia(20%) saturate(200%) hue-rotate(290deg)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
