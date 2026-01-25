"use client";

import { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { srtUtils, type CaptionEntry } from "@/lib/srt-utils";

interface CaptionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipId: string;
  clipTitle?: string | null;
  previewPath?: string | null;
  captionSrt?: string | null;
  onSave: () => Promise<void> | void;
}

export function CaptionEditorDialog({
  open,
  onOpenChange,
  clipId,
  clipTitle,
  previewPath,
  captionSrt,
  onSave
}: CaptionEditorDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (captionSrt) {
      setCaptions(srtUtils.parseSRT(captionSrt));
    }
  }, [captionSrt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime * 1000);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  function updateCaption(index: number, text: string) {
    setCaptions((prev) =>
      prev.map((cap) => (cap.index === index ? { ...cap, text } : cap))
    );
  }

  function seekToCaption(startMs: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = startMs / 1000;
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const newSrt = srtUtils.buildSRT(captions);

      const response = await fetch(`/api/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionSrt: newSrt }),
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to save captions");
      }

      toast({
        title: "Captions saved",
        description: "Your caption edits have been saved successfully."
      });

      await onSave();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Unable to save caption changes. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!captionSrt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Captions Available</DialogTitle>
            <DialogDescription>
              Generate captions first before editing them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Captions</DialogTitle>
          <DialogDescription>
            {clipTitle || "Clip"} • {captions.length} caption entries
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[2fr_1fr] gap-4 flex-1 min-h-0">
          {/* Video Player */}
          <div className="space-y-2">
            <Label>Video Preview</Label>
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
              {previewPath ? (
                <video
                  ref={videoRef}
                  src={previewPath}
                  controls
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No preview available
                </div>
              )}
            </div>
          </div>

          {/* Caption Timeline */}
          <div className="flex flex-col min-h-0">
            <Label className="mb-2">Caption Timeline</Label>
            <div className="flex-1 border rounded-lg overflow-y-auto">
              <div className="p-2 space-y-2">
                {captions.map((caption) => {
                  const isActive =
                    currentTime >= caption.startMs && currentTime <= caption.endMs;

                  return (
                    <div
                      key={caption.index}
                      className={`p-3 border rounded-md space-y-2 transition-colors cursor-pointer ${
                        isActive ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => seekToCaption(caption.startMs)}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>#{caption.index}</span>
                        <div className="flex items-center gap-1">
                          <span>{srtUtils.formatSRTTime(caption.startMs).substring(3, 11)}</span>
                          <span>→</span>
                          <span>{srtUtils.formatSRTTime(caption.endMs).substring(3, 11)}</span>
                        </div>
                      </div>
                      <Textarea
                        value={caption.text}
                        onChange={(e) => updateCaption(caption.index, e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                        placeholder="Caption text..."
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
