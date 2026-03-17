"use client";

import { useState } from "react";
import { Volume2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const VOICES = [
  { id: "alloy", name: "Alloy", description: "Neutral and balanced", gender: "neutral" },
  { id: "echo", name: "Echo", description: "Male, warm", gender: "male" },
  { id: "fable", name: "Fable", description: "Male, expressive", gender: "male" },
  { id: "onyx", name: "Onyx", description: "Male, deep", gender: "male" },
  { id: "nova", name: "Nova", description: "Female, friendly", gender: "female" },
  { id: "shimmer", name: "Shimmer", description: "Female, energetic", gender: "female" },
  { id: "coral", name: "Coral", description: "Female, warm", gender: "female" },
  { id: "sage", name: "Sage", description: "Male, calm", gender: "male" },
  { id: "ash", name: "Ash", description: "Male, professional", gender: "male" },
];

// OpenAI TTS supports 9 professional voices
interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onPreview?: (voice: string) => void;
  isPreviewPlaying?: boolean;
  disabled?: boolean;
}

export function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  onPreview,
  isPreviewPlaying,
  disabled = false,
}: VoiceSelectorProps) {
  const selectedVoiceData = VOICES.find((v) => v.id === selectedVoice);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Voice Selection</Label>
      </div>

      <Select value={selectedVoice} onValueChange={onVoiceChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VOICES.map((voice) => (
            <SelectItem key={voice.id} value={voice.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{voice.name}</span>
                <span className="text-xs text-muted-foreground">
                  · {voice.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedVoiceData && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedVoiceData.description}
          </p>
          {selectedVoiceData.gender && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
              {selectedVoiceData.gender}
            </span>
          )}
        </div>
      )}

      {onPreview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPreview(selectedVoice)}
          disabled={isPreviewPlaying || disabled}
          className="w-full"
        >
          {isPreviewPlaying ? (
            <>
              <Pause className="mr-2 h-3 w-3" />
              Playing Preview...
            </>
          ) : (
            <>
              <Play className="mr-2 h-3 w-3" />
              Preview Voice
            </>
          )}
        </Button>
      )}
    </Card>
  );
}
