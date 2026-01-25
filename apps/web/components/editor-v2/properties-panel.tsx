"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface PropertiesPanelProps {
  selectedAspect?: string;
  onAspectChange?: (value: string) => void;
}

export function PropertiesPanel({ selectedAspect = "9:16", onAspectChange }: PropertiesPanelProps) {
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);

  return (
    <div className="space-y-4" data-testid="properties-panel">
      <header>
        <h3 className="text-lg font-semibold">Properties</h3>
        <p className="text-xs text-muted-foreground">Adjust format, resolution, and brand settings for future exports.</p>
      </header>
      <div className="space-y-3 text-sm">
        <div className="space-y-2">
          <Label>Format & aspect</Label>
          <Select value={selectedAspect} onValueChange={onAspectChange}>
            <SelectTrigger>
              <SelectValue placeholder="Aspect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9:16">Vertical (9:16)</SelectItem>
              <SelectItem value="1:1">Square (1:1)</SelectItem>
              <SelectItem value="16:9">Landscape (16:9)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Resolution</Label>
          <Select defaultValue="1080p">
            <SelectTrigger>
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p (Pro)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Background color</Label>
          <Input type="color" defaultValue="#050505" className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Watermark</Label>
          <Button
            variant={watermarkEnabled ? "default" : "outline"}
            size="sm"
            type="button"
            onClick={() => setWatermarkEnabled((state) => !state)}
          >
            {watermarkEnabled ? "Watermark enabled" : "Enable watermark"}
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Plan gate</p>
        <p className="mt-1">
          1080p exports and watermark controls are part of Clippers Pro. Upgrade inside the billing tab to unlock
          brand kits across exports.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <a href="/billing">View plans</a>
        </Button>
      </div>
    </div>
  );
}
