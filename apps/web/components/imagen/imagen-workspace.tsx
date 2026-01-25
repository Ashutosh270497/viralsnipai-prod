"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Sparkles, Mic, MicOff, Loader2, X, Wand2, ChevronDown, ImageIcon, Upload as UploadIcon, Settings2, Image as ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { trackEvent } from "@/lib/analytics";
import { bytesToSize } from "@/lib/utils";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
type Quality = "standard" | "premium";

type ApiImage = {
  id: string;
  mimeType: string;
  base64: string;
  prompt: string;
  alt?: string;
  width?: number;
  height?: number;
  aspectRatio?: string | AspectRatio;
};

type GeneratedImage = ApiImage & {
  src: string;
  createdAt: number;
  aspectRatio: AspectRatio;
};

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string }> = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "4:3", label: "Landscape (4:3)" },
  { value: "9:16", label: "Vertical (9:16)" },
  { value: "16:9", label: "Widescreen (16:9)" }
];

const QUALITY_OPTIONS: Array<{ value: Quality; label: string; helper: string }> = [
  { value: "standard", label: "Standard", helper: "Fast, balanced outputs" },
  { value: "premium", label: "Premium", helper: "Sharper detail, slower turnaround" }
];

const COUNT_OPTIONS = [
  { value: "1", label: "1 image" },
  { value: "2", label: "2 images" },
  { value: "3", label: "3 images" },
  { value: "4", label: "4 images" }
];

type ReferenceImage = {
  name: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  base64: string;
};

const REFERENCE_ACCEPT = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"]);
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 5;

const ASPECT_RATIO_NUMBERS: Record<AspectRatio, number> = {
  "1:1": 1,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};

function isAspectRatioValue(value: unknown): value is AspectRatio {
  return typeof value === "string" && (Object.keys(ASPECT_RATIO_NUMBERS) as AspectRatio[]).includes(value as AspectRatio);
}

function normalizeAspectRatioString(value: string | undefined | null): AspectRatio | undefined {
  if (!value) {
    return undefined;
  }
  const compact = value.replace(/\s+/g, "");
  return isAspectRatioValue(compact) ? (compact as AspectRatio) : undefined;
}

function resolveAspectRatio(image: ApiImage, fallback: AspectRatio): AspectRatio {
  const fromMeta = normalizeAspectRatioString(typeof image.aspectRatio === "string" ? image.aspectRatio : undefined);
  if (fromMeta) {
    return fromMeta;
  }

  if (image.width && image.height && image.width > 0 && image.height > 0) {
    const ratio = image.width / image.height;
    let closest: AspectRatio = fallback;
    let smallestDelta = Number.POSITIVE_INFINITY;
    (Object.entries(ASPECT_RATIO_NUMBERS) as Array<[AspectRatio, number]>).forEach(([key, value]) => {
      const delta = Math.abs(value - ratio);
      if (delta < smallestDelta) {
        closest = key;
        smallestDelta = delta;
      }
    });
    return closest;
  }

  return fallback;
}

function toCssAspectRatio(value: AspectRatio) {
  const [w, h] = value.split(":").map(Number);
  return `${w} / ${h}`;
}

export function ImagenWorkspace({ userName }: { userName: string }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<Quality>("standard");
  const [count, setCount] = useState<number>(2);
  const [stylePreset, setStylePreset] = useState("");
  const [seed, setSeed] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const referenceImagesRef = useRef<ReferenceImage[]>([]);
  const [isMediaSupported, setIsMediaSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [promptContext, setPromptContext] = useState("");
  const [isMagicPromptLoading, setIsMagicPromptLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("text-to-image");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const [isAspectRatioOpen, setIsAspectRatioOpen] = useState(false);
  const [isCountOpen, setIsCountOpen] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const speechDraftRef = useRef<string>("");
  const speechFinalRef = useRef<string[]>([]);
  const speechSupportedRef = useRef<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        setProgress((value) => {
          if (value >= 85) {
            return value;
          }
          return value + 7;
        });
      }, 280);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return undefined;
  }, [isGenerating]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      setIsMediaSupported(true);
    }
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
      if (SpeechRecognition) {
        speechSupportedRef.current = true;
      }
    }
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  function clearReferenceImages() {
    referenceImagesRef.current.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
    });
    referenceImagesRef.current = [];
    setReferenceImages([]);
    setReferenceError(null);
  }

  async function handleReferenceImages(files: FileList | File[] | null) {
    if (!files || files.length === 0) {
      return;
    }
    const availableSlots = MAX_REFERENCE_IMAGES - referenceImagesRef.current.length;
    if (availableSlots <= 0) {
      setReferenceError("You can upload up to 5 reference images.");
      return;
    }
    const candidates = Array.from(files).slice(0, availableSlots);
    const processed: ReferenceImage[] = [];
    let encounteredError = false;
    for (const file of candidates) {
      if (!REFERENCE_ACCEPT.has(file.type)) {
        encounteredError = true;
        continue;
      }
      if (file.size > MAX_REFERENCE_BYTES) {
        encounteredError = true;
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.split(",")[1];
        if (!base64) {
          throw new Error("Could not read image contents.");
        }
        processed.push({
          name: file.name,
          mimeType: file.type || "image/png",
          size: file.size,
          previewUrl: URL.createObjectURL(file),
          base64
        });
      } catch (error) {
        console.error("Failed to process reference image", error);
        encounteredError = true;
      }
    }

    if (processed.length > 0) {
      setReferenceImages((current) => {
        const combined = [...current, ...processed].slice(0, MAX_REFERENCE_IMAGES);
        referenceImagesRef.current = combined;
        return combined;
      });
    }

    if (encounteredError) {
      setReferenceError("Some files were skipped. Use PNG, JPG, WEBP, GIF, HEIC, or HEIF under 20MB.");
    } else {
      setReferenceError(null);
    }
  }

  function removeReferenceImage(index: number) {
    setReferenceImages((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      referenceImagesRef.current = next;
      return next;
    });
  }

  async function startRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Mic not supported",
        description: "Your browser does not support microphone recording yet."
      });
      return;
    }
    if (isTranscribingAudio) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        if (chunks.length === 0) {
          toast({
            variant: "destructive",
            title: "No audio detected",
            description: "Try recording again."
          });
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        await submitVoicePrompt(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(750);
      setIsRecording(true);
      setRecordingDuration(0);
      setLiveTranscript("");
      speechDraftRef.current = "";
      speechFinalRef.current = [];

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      if (speechSupportedRef.current && typeof window !== "undefined") {
        try {
          const SpeechRecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognitionCtor) {
            const recognition = new SpeechRecognitionCtor();
            recognition.lang = "en-US";
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.maxAlternatives = 1;
            recognition.onresult = (event: SpeechRecognitionEvent) => {
              const result = event.results[event.resultIndex];
              if (!result) {
                return;
              }
              const transcript = (result[0]?.transcript ?? "").trim();
              if (!transcript) {
                return;
              }
              if (result.isFinal) {
                speechFinalRef.current.push(transcript);
              }
              const interim = result.isFinal ? "" : transcript;
              const combined = [...speechFinalRef.current, interim].filter(Boolean).join(" ").trim();
              if (combined) {
                speechDraftRef.current = combined;
                setLiveTranscript(combined);
              }
            };
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
              console.debug("Speech recognition fallback error", event.error);
            };
            recognition.onend = () => {
              const combined = speechFinalRef.current.join(" ").trim();
              if (combined) {
                speechDraftRef.current = combined;
              }
              speechRecognitionRef.current = null;
            };
            recognition.start();
            speechRecognitionRef.current = recognition;
          }
        } catch (error) {
          console.debug("Speech recognition fallback unavailable", error);
        }
      }
      toast({ title: "Recording…", description: "Speak your prompt, then tap stop." });
      trackEvent({ name: "imagen_record_start" });
    } catch (error) {
      console.error("Failed to start recording", error);
      toast({
        variant: "destructive",
        title: "Microphone unavailable",
        description: "Could not access your mic. Check permissions and try again."
      });
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }
    if (recorder.state !== "inactive") {
      try {
        if (recorder.state === "recording") {
          recorder.requestData();
        }
        recorder.stop();
      } catch (error) {
        console.error("Failed to stop recorder", error);
      }
    }
    setIsRecording(false);

    // Clear recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

  if (speechRecognitionRef.current) {
    try {
      speechRecognitionRef.current.stop();
    } catch {
      // ignore
    }
    speechRecognitionRef.current = null;
  }
  const combinedDraft = speechFinalRef.current.join(" ").trim();
  if (combinedDraft) {
    speechDraftRef.current = combinedDraft;
    setLiveTranscript(combinedDraft);
  }
}

async function submitVoicePrompt(blob: Blob) {
    if (blob.size === 0) {
      return;
    }
    setIsTranscribingAudio(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "prompt.webm");
      const response = await fetch("/api/imagen/transcribe", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail =
          typeof data?.details === "string"
            ? data.details
            : typeof data?.error === "string"
              ? data.error
              : undefined;
        throw new Error(detail ?? "Voice transcription failed");
      }
    const transcript = typeof data.text === "string" ? data.text.trim() : "";
    const fallbackSegments = speechFinalRef.current.join(" ").trim();
    const fallbackDraft = speechDraftRef.current.trim();
    speechDraftRef.current = "";
    speechFinalRef.current = [];

    let finalText = transcript;
    if (!finalText || finalText.startsWith("Voice transcription (mock)")) {
      finalText = fallbackSegments || fallbackDraft;
    }

    if (!finalText) {
      toast({
        variant: "destructive",
        title: "No speech detected",
        description: "We couldn’t hear anything. Try recording again."
      });
      return;
    }

    setPrompt((current) => {
      const base = current?.trim();
      if (!base) {
        return finalText;
      }
      if (base.includes(finalText)) {
        return base;
      }
      return `${base}\n${finalText}`.trim();
    });
    setLiveTranscript("");
    toast({ title: "Voice prompt added", description: "Your voice has been transcribed successfully!" });
    trackEvent({ name: "imagen_record_transcribed", payload: { chars: finalText.length } });
  } catch (error) {
      console.error("Voice transcription error", error);
      toast({
        variant: "destructive",
        title: "Voice transcription failed",
        description: error instanceof Error ? error.message : "Try again in a few seconds."
      });
    } finally {
      setIsTranscribingAudio(false);
    }
  }

  function handleToggleRecording() {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  }

  const handleMagicPrompt = useCallback(async () => {
    if (isMagicPromptLoading) {
      return;
    }

    const contextValue = promptContext.trim();
    const existing = prompt.trim();
    if (!contextValue && !existing) {
      toast({
        variant: "destructive",
        title: "Add context",
        description: "Share a few details or draft prompt before using Magic prompt."
      });
      return;
    }

    setIsMagicPromptLoading(true);
    try {
      const response = await fetch("/api/imagen/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: contextValue || undefined,
          existingPrompt: existing || undefined,
          aspectRatio,
          styleHint: stylePreset.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined
        }),
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.prompt) {
        const detail =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : "Unable to craft a prompt right now.";
        throw new Error(detail);
      }

      setPrompt(String(data.prompt));
      if (typeof data.negativePrompt === "string" && data.negativePrompt.trim() && !negativePrompt.trim()) {
        setNegativePrompt(data.negativePrompt.trim());
      }

      trackEvent({
        name: "imagen_magic_prompt",
        payload: {
          hadContext: Boolean(contextValue),
          hadExisting: Boolean(existing),
          aspectRatio,
          style: stylePreset.trim() || undefined
        }
      });

      toast({
        title: "Prompt ready",
        description: "Updated the prompt with a polished Imagen-ready description."
      });
    } catch (error) {
      console.error("[Imagen] Magic prompt failed", error);
      toast({
        variant: "destructive",
        title: "Magic prompt failed",
        description: error instanceof Error ? error.message : "Try again in a few moments."
      });
    } finally {
      setIsMagicPromptLoading(false);
    }
  }, [
    aspectRatio,
    isMagicPromptLoading,
    negativePrompt,
    prompt,
    promptContext,
    stylePreset,
    toast
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Add a prompt",
        description: "Describe what you want to see to generate an image."
      });
      return;
    }

    if (isGenerating) {
      return;
    }

    setError(null);
    setIsGenerating(true);
    setProgress(12);

    const requestPayload: Record<string, unknown> = {
      prompt: prompt.trim(),
      aspectRatio,
      quality,
      count,
      mode
    };

    if (negativePrompt.trim()) {
      requestPayload.negativePrompt = negativePrompt.trim();
    }

    if (stylePreset.trim()) {
      requestPayload.stylePreset = stylePreset.trim();
    }

    if (seed.trim()) {
      const parsedSeed = Number.parseInt(seed, 10);
      if (!Number.isNaN(parsedSeed)) {
        requestPayload.seed = parsedSeed;
      }
    }
    if (referenceImages.length > 0) {
      requestPayload.referenceImages = referenceImages.map((image) => ({
        mimeType: image.mimeType,
        base64: image.base64,
        filename: image.name
      }));
    }

    try {
      const response = await fetch("/api/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        cache: "no-store"
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof responseData?.details === "string"
            ? responseData.details
            : typeof responseData?.details?.error?.message === "string"
              ? responseData.details.error.message
              : undefined;
        throw new Error(responseData.error ?? detail ?? "Image generation failed");
      }

      const data = responseData as { images?: ApiImage[] };
      const generated = (data.images ?? []).map<GeneratedImage>((image) => {
        const resolved = resolveAspectRatio(image, aspectRatio);
        return {
          ...image,
          aspectRatio: resolved,
          src: `data:${image.mimeType};base64,${image.base64}`,
          createdAt: Date.now()
        };
      });

      if (generated.length === 0) {
        setError("No images returned. Try adjusting your prompt or settings.");
        toast({
          variant: "destructive",
          title: "Nothing generated",
          description: "Try a more detailed prompt or different settings."
        });
      } else {
        setImages(generated);
        setLastPrompt(String(requestPayload.prompt));
        toast({
          title: "Images ready",
          description: `Generated ${generated.length} shot${generated.length === 1 ? "" : "s"}.`
        });
        trackEvent({
          name: "imagen_generate",
          payload: {
            count: generated.length,
            aspectRatio,
            quality,
            hasNegative: Boolean(requestPayload.negativePrompt),
            referenceCount: referenceImages.length,
            stylePreset: stylePreset.trim() || undefined
          }
        });
      }
      setProgress(100);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => {
        setProgress(0);
        resetTimeoutRef.current = null;
      }, 900);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not generate images");
      toast({
        variant: "destructive",
        title: "Image generation failed",
        description: "Check your connection or try again in a few seconds."
      });
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    if (isGenerating) {
      return;
    }
    setPrompt("");
    setNegativePrompt("");
    setStylePreset("");
    setSeed("");
    setPromptContext("");
    setMode("text-to-image");
    setIsAdvancedOpen(false);
    setImages([]);
    setLastPrompt(null);
    clearReferenceImages();
    if (isRecording || mediaRecorderRef.current) {
      stopRecording();
    }
    setProgress(0);
    setError(null);
  }

  const helperText = useMemo(() => {
    if (isRecording) {
      return "Recording… speak clearly and tap stop when you’re done.";
    }
    if (isTranscribingAudio) {
      return "Transcribing your voice prompt…";
    }
    if (!lastPrompt) {
      return "Describe the scene, style, and mood. Imagen handles the rest.";
    }
    return `Showing results for: "${lastPrompt}"`;
  }, [isRecording, isTranscribingAudio, lastPrompt]);

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">AI Image Generator</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Powered by Google Imagen</p>
          </div>
        </div>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground/90">
          Create stunning images with AI using text prompts or transform existing images.
          Describe your vision, choose your style, and watch it come to life in seconds.
        </p>
      </div>
      <section
        aria-labelledby="imagen-heading"
        className="grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]"
      >
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader className="space-y-2 pb-5">
          <CardTitle id="imagen-heading" className="text-lg font-semibold tracking-tight">
            Studio controls
          </CardTitle>
          <CardDescription className="text-sm">Fine-tune your brief before generating new imagery.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3.5 shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsAdvancedOpen((state) => !state)}
              >
                <div className="flex items-center gap-2.5">
                  <Settings2 className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Advanced Settings</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded-full">Optional</Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground/70 transition-transform ${isAdvancedOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
              </button>
              {isAdvancedOpen ? (
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="imagen-negative" className="flex items-center gap-2">
                      <span>Negative Prompt</span>
                      <span className="text-xs text-muted-foreground">(What to avoid)</span>
                    </Label>
                    <Textarea
                      id="imagen-negative"
                      placeholder="e.g., blurry, low quality, distorted, ugly, disfigured..."
                      rows={2}
                      value={negativePrompt}
                      onChange={(event) => setNegativePrompt(event.target.value)}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="imagen-style" className="flex items-center gap-2">
                        <span>Style Preset</span>
                      </Label>
                      <Input
                        id="imagen-style"
                        placeholder="e.g., cinematic, photorealistic"
                        value={stylePreset}
                        onChange={(event) => setStylePreset(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imagen-seed" className="flex items-center gap-2">
                        <span>Seed</span>
                        <span className="text-xs text-muted-foreground">(Reproducibility)</span>
                      </Label>
                      <Input
                        id="imagen-seed"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Random"
                        value={seed}
                        onChange={(event) => setSeed(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3.5 shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsModeOpen((state) => !state)}
              >
                <div className="flex items-center gap-2.5">
                  <Settings2 className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Mode</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">
                    {mode === "text-to-image" ? "Text" : "Image"}
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground/70 transition-transform ${isModeOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
              </button>
              {isModeOpen ? (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "text-to-image", label: "Text to Image", icon: Sparkles },
                      { id: "image-to-image", label: "Image to Image", icon: ImagePlus }
                    ].map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant={mode === option.id ? "default" : "outline"}
                        className={`h-auto flex-col items-center gap-1 p-2 ${
                          mode === option.id ? "ring-2 ring-primary ring-offset-1" : ""
                        }`}
                        onClick={() => setMode(option.id as Mode)}
                      >
                        <option.icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium leading-tight text-center">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Magic Prompt Context Section */}
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-violet-200/60 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:border-violet-800/40 dark:from-violet-950/30 dark:to-purple-950/20 p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-gradient-to-br from-violet-500 to-purple-600 p-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-white" />
                </div>
                <Label htmlFor="imagen-context" className="text-xs font-semibold tracking-tight text-violet-900 dark:text-violet-100">
                  Magic Prompt
                </Label>
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">AI</Badge>
              </div>
              <Textarea
                id="imagen-context"
                placeholder="Brief description: Modern office, natural light, minimalist..."
                rows={2}
                value={promptContext}
                onChange={(event) => setPromptContext(event.target.value)}
                className="resize-none border-violet-200/50 bg-white/80 text-sm dark:border-violet-800/50 dark:bg-background/50 rounded-xl"
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMagicPrompt}
                disabled={isMagicPromptLoading}
                className="w-full h-9 text-xs font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 rounded-xl shadow-sm"
              >
                {isMagicPromptLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-3.5 w-3.5" />
                    Generate Magic Prompt
                  </>
                )}
              </Button>
            </div>

            {/* Main Prompt Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="imagen-prompt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt
                </Label>
                <Button
                  aria-label={isRecording ? "Stop recording" : "Record voice prompt"}
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleToggleRecording}
                  disabled={!isRecording && (!isMediaSupported || isTranscribingAudio)}
                  className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                    isRecording
                      ? "animate-pulse shadow-lg"
                      : !isMediaSupported
                      ? "opacity-50"
                      : "hover:shadow-md"
                  }`}
                  title={!isMediaSupported ? "Microphone not supported in your browser" : undefined}
                >
                  {isTranscribingAudio ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Mic className="mr-1 h-3.5 w-3.5" />
                  )}
                  {isRecording ? "Stop" : "Voice"}
                </Button>
              </div>
              {isRecording ? (
                <div className="space-y-3 rounded-2xl border-2 border-rose-300/60 bg-gradient-to-br from-rose-50/80 to-pink-50/60 dark:border-rose-800/40 dark:from-rose-950/40 dark:to-pink-950/20 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600"></span>
                      </div>
                      <p className="text-xs font-semibold tracking-tight text-rose-800 dark:text-rose-300">
                        Recording
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-rose-200/60 px-2.5 py-1 dark:bg-rose-900/40 shadow-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse" />
                      <span className="font-mono text-[10px] font-bold text-rose-800 dark:text-rose-300">
                        {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  {liveTranscript && (
                    <div className="rounded-xl border border-rose-200/50 bg-white/70 backdrop-blur-sm p-3 dark:border-rose-900/50 dark:bg-black/30">
                      <p className="text-xs italic text-gray-700 dark:text-gray-300">
                        "{liveTranscript}"
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                    💬 Speak clearly • Click "Stop" when done
                  </p>
                </div>
              ) : isTranscribingAudio ? (
                <div className="flex items-center gap-3 rounded-2xl border border-blue-300/60 bg-gradient-to-br from-blue-50/80 to-cyan-50/60 dark:border-blue-800/40 dark:from-blue-950/40 dark:to-cyan-950/20 px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-medium tracking-tight text-blue-800 dark:text-blue-300">Processing your voice...</p>
                </div>
              ) : null}
              <Textarea
                id="imagen-prompt"
                placeholder="Cinematic shot of neon-lit Tokyo alley, rain, vibrant colors, 8k..."
                rows={4}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">
                  💡 Include subject, style, lighting, and mood
                </p>
                {!isRecording && !isTranscribingAudio && isMediaSupported && (
                  <p className="text-[9px] text-muted-foreground/60">
                    Tip: Use voice for faster input
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3.5 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsQualityOpen((state) => !state)}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings2 className="h-4 w-4 text-muted-foreground/70" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Quality</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full capitalize">{quality}</Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/70 transition-transform ${isQualityOpen ? '' : '-rotate-90'}`}
                    aria-hidden="true"
                  />
                </button>
                {isQualityOpen ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {QUALITY_OPTIONS.map((option) => {
                        const isSelected = quality === option.value;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto flex-col items-center gap-0.5 p-1.5 text-center ${
                              isSelected ? "ring-2 ring-primary ring-offset-1" : ""
                            }`}
                            onClick={() => setQuality(option.value as Quality)}
                          >
                            <span className="text-[10px] font-semibold">{option.label}</span>
                            <span className={`text-[9px] leading-tight ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {option.helper}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3.5 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsAspectRatioOpen((state) => !state)}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings2 className="h-4 w-4 text-muted-foreground/70" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Aspect Ratio</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">{aspectRatio}</Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/70 transition-transform ${isAspectRatioOpen ? '' : '-rotate-90'}`}
                    aria-hidden="true"
                  />
                </button>
                {isAspectRatioOpen ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-3 gap-2">
                      {ASPECT_RATIO_OPTIONS.map((option) => {
                        const [w, h] = option.value.split(':').map(Number);
                        const isSelected = aspectRatio === option.value;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto flex-col gap-1 p-1.5 ${
                              isSelected ? "ring-2 ring-primary ring-offset-1" : ""
                            }`}
                            onClick={() => setAspectRatio(option.value)}
                          >
                            <div
                              className={`rounded border bg-gradient-to-br ${
                                isSelected
                                  ? "border-primary-foreground/20 from-primary-foreground/20 to-primary-foreground/10"
                                  : "border-muted-foreground/20 from-muted/50 to-muted/30"
                              }`}
                              style={{
                                width: w > h ? "24px" : `${(w / h) * 24}px`,
                                height: h > w ? "24px" : `${(h / w) * 24}px`
                              }}
                            />
                            <span className={`text-[9px] font-semibold leading-tight ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                              {option.value}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3.5 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsCountOpen((state) => !state)}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings2 className="h-4 w-4 text-muted-foreground/70" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Count</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">{count} {count === 1 ? "img" : "imgs"}</Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/70 transition-transform ${isCountOpen ? '' : '-rotate-90'}`}
                    aria-hidden="true"
                  />
                </button>
                {isCountOpen ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-4 gap-2">
                      {COUNT_OPTIONS.map((option) => {
                        const isSelected = count === Number(option.value);
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto flex-col gap-0.5 py-1.5 ${
                              isSelected ? "ring-2 ring-primary ring-offset-1" : ""
                            }`}
                            onClick={() => setCount(Number.parseInt(option.value, 10))}
                          >
                            <span className="text-base font-bold">{option.value}</span>
                            <span className={`text-[9px] leading-tight ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {option.value === "1" ? "img" : "imgs"}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/70" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</Label>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">
                    {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => referenceInputRef.current?.click()}
                  disabled={referenceImages.length >= MAX_REFERENCE_IMAGES}
                  className="h-8 px-3 text-xs rounded-lg border-border/50 hover:border-border"
                >
                  <UploadIcon className="mr-1.5 h-3 w-3" />
                  Upload
                </Button>
              </div>
              <input
                ref={referenceInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  void handleReferenceImages(event.target.files);
                  event.target.value = "";
                }}
              />
              {referenceImages.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {referenceImages.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="space-y-2 rounded-2xl border border-border/40 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-3 shadow-sm">
                      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-muted/50">
                        <Image
                          src={image.previewUrl}
                          alt={image.name}
                          fill
                          sizes="(min-width: 768px) 33vw, 100vw"
                          className="object-cover"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 rounded-full shadow-sm backdrop-blur-sm"
                          onClick={() => removeReferenceImage(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove reference</span>
                        </Button>
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-foreground truncate">{image.name}</p>
                        <p className="text-muted-foreground/70">{bytesToSize(image.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => referenceInputRef.current?.click()}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-br from-slate-50/30 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-6 text-center transition-all hover:border-violet-300 hover:bg-gradient-to-br hover:from-violet-50/40 hover:to-purple-50/30 dark:hover:border-violet-700 dark:hover:from-violet-950/30 dark:hover:to-purple-950/20"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-2.5 transition-transform group-hover:scale-110">
                      <UploadIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Click to upload</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">PNG, JPG, WEBP</p>
                    </div>
                  </div>
                </button>
              )}
              {referenceError ? <p className="text-xs text-destructive">{referenceError}</p> : null}
            </div>

            {isGenerating && (
              <div className="space-y-3 rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:border-violet-800/40 dark:from-violet-950/30 dark:to-purple-950/20 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold tracking-tight text-foreground">Creating image...</p>
                  </div>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} aria-label="Imagen generation progress" className="h-2 rounded-full" />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-destructive/40 bg-gradient-to-br from-red-50/80 to-rose-50/60 dark:from-red-950/40 dark:to-rose-950/20 p-3 shadow-sm">
                <p className="text-xs font-medium text-destructive">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row pt-2">
              <Button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="flex-1 h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate {count} {count === 1 ? "Image" : "Images"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isGenerating}
                className="h-11 text-sm sm:w-28 rounded-xl border-border/50 hover:border-border"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader className="space-y-2 pb-5">
          <CardTitle className="text-lg font-semibold tracking-tight">Generated images</CardTitle>
          <CardDescription className="text-sm">{helperText}</CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-12 text-center">
              <div className="flex flex-col items-center gap-8 max-w-md">
                <div className="rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-8">
                  <ImageIcon className="h-14 w-14 text-muted-foreground/70" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">No Images Generated Yet</h3>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">
                    Your AI-generated images will appear here. Start by describing what you want to create, or use the Magic Prompt feature for inspiration.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Combine subject, lighting, and style for best results</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Use reference images to guide the AI's style</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Experiment with different aspect ratios</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {images.map((image) => (
                <figure
                  key={image.id}
                  className="group overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative w-full bg-muted/50" style={{ aspectRatio: toCssAspectRatio(image.aspectRatio) }}>
                    <Image
                      src={image.src}
                      alt={image.alt ?? `Generated image for ${image.prompt}`}
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      unoptimized
                    />
                  </div>
                  <figcaption className="space-y-3 p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground/70 font-medium">
                      <span>
                        {image.mimeType.replace("image/", "").toUpperCase()} · {image.aspectRatio}
                      </span>
                      <span>{new Date(image.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full rounded-xl hover:bg-secondary/80"
                      onClick={() => downloadImage(image)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unexpected file reader result."));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file."));
    };
    reader.readAsDataURL(file);
  });
}

function downloadImage(image: GeneratedImage) {
  const link = document.createElement("a");
  const extension = image.mimeType.includes("svg") ? "svg" : "png";
  link.href = image.src;
  link.download = `${slugify(image.prompt)}-${image.id}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "imagen";
}
