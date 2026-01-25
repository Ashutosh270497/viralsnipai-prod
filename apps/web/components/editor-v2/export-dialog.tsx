"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExportDialogProps {
  projectId: string;
  clipIds: string[];
  presets: Array<{ id: string; label: string }>;
  onQueue: (preset: string) => Promise<void> | void;
  disabled?: boolean;
}

export function ExportDialog({ projectId, clipIds, presets, onQueue, disabled }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0]?.id ?? "");
  const isDisabled = disabled || clipIds.length === 0;

  async function handleQueue() {
    if (!selectedPreset) return;
    await onQueue(selectedPreset);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isDisabled} size="lg">Export clips</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Queue export</DialogTitle>
          <DialogDescription>Clips selected: {clipIds.length} · Project ID: {projectId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Export queue runs in the background. You’ll see progress next to each preset once rendering begins.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancel
          </Button>
          <Button onClick={() => void handleQueue()} type="button">
            Queue export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
