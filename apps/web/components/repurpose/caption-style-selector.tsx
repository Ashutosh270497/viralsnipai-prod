"use client";

import { useState } from "react";
import { Palette, Download, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CAPTION_STYLES = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean, professional look with subtle highlights",
    preview: "💼 Professional",
    colors: {
      power: "#FFD700",
      number: "#00FF88",
      emotion: "#FF6B9D"
    }
  },
  {
    id: "viral",
    name: "Viral",
    description: "Aggressive highlights with animations for maximum attention",
    preview: "🔥 Attention-Grabbing",
    colors: {
      power: "#FFD700",
      number: "#00FF88",
      emotion: "#FF3366"
    }
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Subtle emphasis without colors, focus on typography",
    preview: "✨ Clean & Simple",
    colors: {
      power: "#FFFFFF",
      number: "#FFFFFF",
      emotion: "#FFFFFF"
    }
  },
  {
    id: "gaming",
    name: "Gaming",
    description: "Bold, energetic style with strong highlights",
    preview: "🎮 Energetic",
    colors: {
      power: "#FF0000",
      number: "#00FF00",
      emotion: "#FF00FF"
    }
  },
  {
    id: "business",
    name: "Business",
    description: "Professional look with conservative highlights",
    preview: "📊 Corporate",
    colors: {
      power: "#4A90E2",
      number: "#50C878",
      emotion: "#E94B3C"
    }
  }
];

const AGGRESSIVENESS_LEVELS = [
  { value: "subtle", label: "Subtle", description: "Minimal highlights" },
  { value: "moderate", label: "Moderate", description: "Balanced emphasis" },
  { value: "aggressive", label: "Aggressive", description: "Maximum impact" }
];

interface CaptionStyleSelectorProps {
  clipId?: string;
  onStyleApplied?: () => void;
}

export function CaptionStyleSelector({ clipId, onStyleApplied }: CaptionStyleSelectorProps) {
  const { toast } = useToast();
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [aggressiveness, setAggressiveness] = useState("moderate");
  const [exportFormat, setExportFormat] = useState("srt");
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const currentStyle = CAPTION_STYLES.find(s => s.id === selectedStyle) || CAPTION_STYLES[0];

  const handleApplyStyle = async () => {
    if (!clipId) {
      toast({
        variant: "destructive",
        title: "No clip selected",
        description: "Please select a clip to apply caption styling"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // This would call an API endpoint to apply caption styling
      // For now, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock quality score (would come from API)
      const mockScore = Math.floor(Math.random() * 20) + 75; // 75-95
      setQualityScore(mockScore);

      toast({
        title: "Style applied",
        description: `Captions enhanced with ${currentStyle.name} style`
      });

      if (onStyleApplied) {
        onStyleApplied();
      }
    } catch (error) {
      console.error("Failed to apply style:", error);
      toast({
        variant: "destructive",
        title: "Style application failed",
        description: "Please try again"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!clipId) {
      toast({
        variant: "destructive",
        title: "No clip selected",
        description: "Please select a clip to export captions"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(`/api/clips/${clipId}/export-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: selectedStyle,
          aggressiveness,
          format: exportFormat
        })
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `captions_${selectedStyle}_${clipId}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Captions exported",
        description: `Downloaded as ${exportFormat.toUpperCase()} format`
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Please try again"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getAggressivenessValue = () => {
    switch (aggressiveness) {
      case "subtle": return 0;
      case "moderate": return 50;
      case "aggressive": return 100;
      default: return 50;
    }
  };

  const handleAggressivenessChange = (value: number[]) => {
    const level = value[0];
    if (level < 33) setAggressiveness("subtle");
    else if (level < 67) setAggressiveness("moderate");
    else setAggressiveness("aggressive");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Caption Style Enhancement
          </CardTitle>
          <CardDescription>
            Auto-detect and highlight power words, numbers, emotions, and actions in your captions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Style Selection */}
          <div className="space-y-3">
            <Label>Caption Style</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CAPTION_STYLES.map((style) => (
                <Card
                  key={style.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedStyle === style.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{style.preview}</span>
                      {selectedStyle === style.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <h4 className="font-medium mb-1">{style.name}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{style.description}</p>
                    <div className="flex gap-1">
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: style.colors.power }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: style.colors.number }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: style.colors.emotion }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Aggressiveness Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Emphasis Level</Label>
              <Badge variant="outline" className="capitalize">
                {aggressiveness}
              </Badge>
            </div>
            <Slider
              value={[getAggressivenessValue()]}
              onValueChange={handleAggressivenessChange}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtle</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
          </div>

          {/* Highlight Preview */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <Label className="mb-2 block">Style Preview</Label>
            <div className="space-y-2 text-sm">
              <p>
                I made{" "}
                <span
                  className="font-bold px-1"
                  style={{ color: currentStyle.colors.number }}
                >
                  $100k
                </span>{" "}
                in my{" "}
                <span
                  className="font-bold px-1"
                  style={{ color: currentStyle.colors.power }}
                >
                  first
                </span>{" "}
                month
              </p>
              <p className="text-xs text-muted-foreground">
                🟡 Power words • 🟢 Numbers • 🔴 Emotions
              </p>
            </div>
          </div>

          {/* Quality Score */}
          {qualityScore !== null && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Caption Quality Score</Label>
                <Badge className="bg-green-500">
                  {qualityScore}/100
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {qualityScore >= 85 && "Excellent! Your captions have strong engagement potential."}
                {qualityScore >= 70 && qualityScore < 85 && "Good caption quality with room for improvement."}
                {qualityScore < 70 && "Consider adding more power words and emotional language."}
              </p>
            </div>
          )}

          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem showIndicator value="srt">SRT (SubRip)</SelectItem>
                <SelectItem showIndicator value="vtt">WebVTT</SelectItem>
                <SelectItem showIndicator value="json">JSON (Custom Rendering)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleApplyStyle}
              disabled={isProcessing || !clipId}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Palette className="mr-2 h-4 w-4" />
              )}
              Apply Style
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isProcessing || !clipId}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          {!clipId && (
            <p className="text-xs text-center text-muted-foreground">
              Select a clip to apply caption styling
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feature Legend */}
      <Card>
        <CardContent className="pt-6">
          <Label className="mb-3 block">What Gets Highlighted</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <Badge variant="outline" className="w-full justify-start">
                🟡 Power Words
              </Badge>
              <p className="text-muted-foreground pl-2">
                transform, unlock, discover, proven, guaranteed
              </p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="w-full justify-start">
                🟢 Numbers & Metrics
              </Badge>
              <p className="text-muted-foreground pl-2">
                $100k, 50%, 3x growth, specific data points
              </p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="w-full justify-start">
                🔴 Emotions
              </Badge>
              <p className="text-muted-foreground pl-2">
                love, excited, shocked, amazing, powerful
              </p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="w-full justify-start">
                🔵 Actions
              </Badge>
              <p className="text-muted-foreground pl-2">
                learn, build, create, grow, achieve
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
