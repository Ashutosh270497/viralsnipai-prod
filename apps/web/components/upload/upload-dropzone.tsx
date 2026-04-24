"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { bytesToSize, cn } from "@/lib/utils";

type AcceptEntry = string | Array<string>;

export interface UploadDropzoneProps {
  projectId: string;
  onUpload: (file: File) => Promise<void> | void;
  accept?: Record<string, AcceptEntry>;
  maxSizeMb?: number;
  /** Recommended max source duration, shown as microcopy. */
  recommendedDurationMinutes?: number;
  description?: string;
  /** Optional short list of concrete format hints, e.g. ["MP4", "MOV", "MP3"]. */
  formatHints?: string[];
  "data-testid"?: string;
}

type UploadState =
  | { kind: "idle" }
  | { kind: "validating"; file: File }
  | { kind: "uploading"; file: File }
  | { kind: "success"; file: File }
  | { kind: "error"; message: string; file?: File };

const DEFAULT_ACCEPT: Record<string, string[]> = {
  "video/*": [],
  "audio/*": [],
};

const DEFAULT_MAX_SIZE_MB = 4096;
const DEFAULT_FORMATS = ["MP4", "MOV", "WebM", "MP3", "WAV", "M4A"];
const DEFAULT_RECOMMENDED_MINUTES = 180;

export function UploadDropzone({
  projectId,
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  recommendedDurationMinutes = DEFAULT_RECOMMENDED_MINUTES,
  description = "Drop a video or audio file here",
  formatHints = DEFAULT_FORMATS,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  const acceptAttr = useMemo(() => Object.keys(accept).join(","), [accept]);

  const validateFile = useCallback(
    (file: File) => {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSizeMb) {
        const maxLabel =
          maxSizeMb >= 1024
            ? `${(maxSizeMb / 1024).toFixed(maxSizeMb % 1024 === 0 ? 0 : 1)} GB`
            : `${maxSizeMb} MB`;
        return `File is larger than the ${maxLabel} limit.`;
      }

      const acceptedTypes = Object.keys(accept);
      if (acceptedTypes.length === 0) return undefined;

      const isAccepted = acceptedTypes.some((type) => {
        if (type.includes("/*")) {
          const prefix = type.replace("/*", "");
          return file.type.startsWith(prefix);
        }
        return file.type === type;
      });

      return isAccepted
        ? undefined
        : `Unsupported file type. Try ${formatHints.slice(0, 3).join(", ")}.`;
    },
    [accept, formatHints, maxSizeMb],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const [file] = files;
      setState({ kind: "validating", file });

      const error = validateFile(file);
      if (error) {
        setState({ kind: "error", message: error, file });
        return;
      }

      setState({ kind: "uploading", file });
      try {
        await onUpload(file);
        setState({ kind: "success", file });
      } catch (err) {
        console.error(err);
        setState({
          kind: "error",
          message: "Upload failed. Check your connection and try again.",
          file,
        });
      }
    },
    [onUpload, validateFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);
      void handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  }, []);

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
    // reset so the same file can be reselected after a failure
    event.target.value = "";
  }

  const maxSizeLabel =
    maxSizeMb >= 1024
      ? `${(maxSizeMb / 1024).toFixed(maxSizeMb % 1024 === 0 ? 0 : 1)} GB`
      : `${maxSizeMb} MB`;

  const durationLabel =
    recommendedDurationMinutes >= 60
      ? `${Math.round(recommendedDurationMinutes / 60)} hr`
      : `${recommendedDurationMinutes} min`;

  const isBusy = state.kind === "validating" || state.kind === "uploading";

  return (
    <div className="space-y-3" data-testid="upload-dropzone">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onInputChange}
        accept={acceptAttr}
        data-project-id={projectId}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isBusy) return;
          inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (isBusy) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-busy={isBusy}
        aria-disabled={isBusy}
        className={cn(
          "rounded-2xl border-2 border-dashed border-border/70 bg-secondary/30 p-8 transition outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isDragActive && "border-primary/60 bg-primary/[0.06]",
          !isDragActive && !isBusy && "hover:border-primary/40 hover:bg-secondary/40",
          isBusy && "cursor-progress opacity-80",
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-primary/10 p-4 text-primary">
            <UploadCloud className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Drag &amp; drop or click to browse
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button variant="outline" size="sm" type="button" disabled={isBusy}>
            Browse files
          </Button>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
            <span>Formats: {formatHints.join(" · ")}</span>
            <span aria-hidden>•</span>
            <span>Max size: {maxSizeLabel}</span>
            <span aria-hidden>•</span>
            <span>Up to {durationLabel} recommended</span>
          </div>
          <p className="mt-1 max-w-sm text-[11px] text-muted-foreground/60">
            We&apos;ll find the strongest moments and prepare clips for short-form platforms.
          </p>
        </div>
      </div>

      <UploadStatus state={state} onDismiss={() => setState({ kind: "idle" })} />
    </div>
  );
}

function UploadStatus({
  state,
  onDismiss,
}: {
  state: UploadState;
  onDismiss: () => void;
}) {
  if (state.kind === "idle") return null;

  if (state.kind === "validating" || state.kind === "uploading") {
    const label = state.kind === "validating" ? "Checking file…" : "Uploading…";
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{state.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {bytesToSize(state.file.size)} · {label}
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-sm"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            Uploaded {state.file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {bytesToSize(state.file.size)} · Ready to detect highlights.
          </p>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{state.message}</p>
        {state.file ? (
          <p className="text-xs opacity-80">
            {state.file.name} · {bytesToSize(state.file.size)}
          </p>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={onDismiss}
        className="text-destructive hover:text-destructive"
      >
        <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
        Dismiss
      </Button>
    </div>
  );
}
