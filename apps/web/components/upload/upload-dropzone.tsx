"use client";

import { ChangeEvent, DragEvent, useCallback, useRef, useState } from "react";
import { UploadCloud, FileWarning, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bytesToSize, cn } from "@/lib/utils";

type AcceptEntry = string | Array<string>;

export interface UploadDropzoneProps {
  projectId: string;
  onUpload: (file: File) => Promise<void> | void;
  accept?: Record<string, AcceptEntry>;
  maxSizeMb?: number;
  description?: string;
  "data-testid"?: string;
}

interface DropState {
  isDragActive: boolean;
  error?: string;
  success?: string;
}

const DEFAULT_ACCEPT: Record<string, string[]> = {
  "video/*": [],
  "audio/*": []
};

const MAX_SIZE_MB = 4096;

export function UploadDropzone({
  projectId,
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = MAX_SIZE_MB,
  description = "Drop video or audio files"
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropState, setDropState] = useState<DropState>({ isDragActive: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback(
    (file: File) => {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSizeMb) {
        return `File exceeds ${maxSizeMb}MB limit.`;
      }

      const acceptedTypes = Object.keys(accept);
      if (acceptedTypes.length === 0) {
        return undefined;
      }
      const isAccepted = acceptedTypes.some((type) => {
        if (type.includes("/*")) {
          const prefix = type.replace("/*", "");
          return file.type.startsWith(prefix);
        }
        return file.type === type;
      });
      return isAccepted ? undefined : "Unsupported file type.";
    },
    [accept, maxSizeMb]
  );

  const resetFeedback = () => setDropState({ isDragActive: false });

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      const [file] = files;
      const error = validateFile(file);
      if (error) {
        setDropState((state) => ({ ...state, error }));
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setDropState({ isDragActive: false, success: undefined, error: undefined });
      setIsUploading(true);
      try {
        await onUpload(file);
        setDropState({ isDragActive: false, success: "Upload complete." });
        setSelectedFile(null);
      } catch (err) {
        console.error(err);
        setDropState({ isDragActive: false, error: "Upload failed. Please retry." });
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDropState((state) => ({ ...state, isDragActive: false }));
      void handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropState((state) => ({ ...state, isDragActive: true }));
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropState((state) => ({ ...state, isDragActive: false }));
  }, []);

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  return (
    <div className="space-y-4" data-testid="upload-dropzone">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onInputChange}
        accept={Object.keys(accept).join(",")}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-3xl border-2 border-dashed border-border/80 bg-secondary/40 p-8 transition",
          dropState.isDragActive ? "border-brand-500 bg-brand-500/10" : "hover:border-brand-500/60 hover:bg-secondary/50"
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="rounded-full bg-brand-500/15 p-4 text-brand-500">
            <UploadCloud className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Drag & drop or browse files</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground">Max size: {maxSizeMb} MB</p>
          </div>
          <Button variant="outline" size="sm" type="button">
            Browse files
          </Button>
        </div>
      </div>

      {selectedFile ? (
        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{bytesToSize(selectedFile.size)}</p>
          </div>
          {isUploading ? (
            <span className="text-xs text-muted-foreground">Uploading…</span>
          ) : dropState.success ? (
            <span className="inline-flex items-center gap-1 text-xs text-brand-500">
              <CheckCircle className="h-4 w-4" aria-hidden />
              {dropState.success}
            </span>
          ) : null}
        </div>
      ) : null}

      {dropState.error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <FileWarning className="h-4 w-4" aria-hidden />
          <span>{dropState.error}</span>
          <Button variant="ghost" size="sm" type="button" onClick={resetFeedback}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}
