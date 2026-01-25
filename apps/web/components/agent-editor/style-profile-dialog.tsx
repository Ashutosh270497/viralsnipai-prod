"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Palette, Sparkles, Image, Grid3x3 } from "lucide-react";

interface StyleProfile {
  id: string;
  name: string;
  referenceVideos: string[];
  styleConfig: any;
  isDefault: boolean;
}

interface StyleProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: StyleProfile | null;
  onSuccess: () => void;
}

export function StyleProfileDialog({
  open,
  onOpenChange,
  profile,
  onSuccess
}: StyleProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Color Grading
  const [temperature, setTemperature] = useState(5);
  const [tint, setTint] = useState(0);
  const [contrast, setContrast] = useState(110);
  const [saturation, setSaturation] = useState(105);
  const [highlights, setHighlights] = useState(-10);
  const [shadows, setShadows] = useState(15);
  const [vibrance, setVibrance] = useState(115);

  // Aesthetics
  const [vignetteEnabled, setVignetteEnabled] = useState(true);
  const [vignetteIntensity, setVignetteIntensity] = useState(15);
  const [filmGrainEnabled, setFilmGrainEnabled] = useState(false);
  const [filmGrainAmount, setFilmGrainAmount] = useState(0);
  const [sharpen, setSharpen] = useState(25);
  const [blur, setBlur] = useState(0);

  // Composition
  const [cropRatio, setCropRatio] = useState("9:16");
  const [safeZones, setSafeZones] = useState(true);
  const [rulesOfThirds, setRulesOfThirds] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setIsDefault(profile.isDefault);

      const config = profile.styleConfig || {};

      // Load color grading
      if (config.colorGrading) {
        setTemperature(config.colorGrading.temperature ?? 5);
        setTint(config.colorGrading.tint ?? 0);
        setContrast(config.colorGrading.contrast ?? 110);
        setSaturation(config.colorGrading.saturation ?? 105);
        setHighlights(config.colorGrading.highlights ?? -10);
        setShadows(config.colorGrading.shadows ?? 15);
        setVibrance(config.colorGrading.vibrance ?? 115);
      }

      // Load aesthetics
      if (config.aesthetics) {
        setVignetteEnabled(config.aesthetics.vignette?.enabled ?? true);
        setVignetteIntensity(config.aesthetics.vignette?.intensity ?? 15);
        setFilmGrainEnabled(config.aesthetics.filmGrain?.enabled ?? false);
        setFilmGrainAmount(config.aesthetics.filmGrain?.amount ?? 0);
        setSharpen(config.aesthetics.sharpen ?? 25);
        setBlur(config.aesthetics.blur ?? 0);
      }

      // Load composition
      if (config.composition) {
        setCropRatio(config.composition.cropRatio ?? "9:16");
        setSafeZones(config.composition.safeZones ?? true);
        setRulesOfThirds(config.composition.rulesOfThirds ?? false);
      }
    } else {
      // Reset to defaults when creating new
      setName("");
      setIsDefault(false);
      resetToDefaults();
    }
  }, [profile, open]);

  const resetToDefaults = () => {
    setTemperature(5);
    setTint(0);
    setContrast(110);
    setSaturation(105);
    setHighlights(-10);
    setShadows(15);
    setVibrance(115);
    setVignetteEnabled(true);
    setVignetteIntensity(15);
    setFilmGrainEnabled(false);
    setFilmGrainAmount(0);
    setSharpen(25);
    setBlur(0);
    setCropRatio("9:16");
    setSafeZones(true);
    setRulesOfThirds(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    const styleConfig = {
      colorGrading: {
        temperature,
        tint,
        contrast,
        saturation,
        highlights,
        shadows,
        vibrance
      },
      aesthetics: {
        vignette: {
          enabled: vignetteEnabled,
          intensity: vignetteIntensity
        },
        filmGrain: {
          enabled: filmGrainEnabled,
          amount: filmGrainAmount
        },
        sharpen,
        blur
      },
      composition: {
        cropRatio,
        safeZones,
        rulesOfThirds
      }
    };

    try {
      const url = profile
        ? `/api/agent-editor/style-profiles/${profile.id}`
        : "/api/agent-editor/style-profiles";

      const method = profile ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          styleConfig,
          referenceVideos: [],
          isDefault
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: profile
            ? "Style profile updated successfully"
            : "Style profile created successfully"
        });
        onSuccess();
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save style profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {profile ? "Edit Style Profile" : "Create Style Profile"}
          </DialogTitle>
          <DialogDescription>
            Configure color grading, aesthetics, and composition settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input
                id="name"
                placeholder="e.g., Cinematic Dark, Bright & Vibrant"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="default" className="cursor-pointer">
                Set as default style profile
              </Label>
            </div>
          </div>

          {/* Tabs for different settings */}
          <Tabs defaultValue="color" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="color">
                <Palette className="h-4 w-4 mr-2" />
                Color Grading
              </TabsTrigger>
              <TabsTrigger value="aesthetics">
                <Sparkles className="h-4 w-4 mr-2" />
                Aesthetics
              </TabsTrigger>
              <TabsTrigger value="composition">
                <Grid3x3 className="h-4 w-4 mr-2" />
                Composition
              </TabsTrigger>
            </TabsList>

            {/* Color Grading Tab */}
            <TabsContent value="color" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Temperature</Label>
                    <span className="text-sm text-muted-foreground">{temperature}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={(v) => setTemperature(v[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Cool to Warm</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Tint</Label>
                    <span className="text-sm text-muted-foreground">{tint}</span>
                  </div>
                  <Slider
                    value={[tint]}
                    onValueChange={(v) => setTint(v[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Green to Magenta</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Contrast</Label>
                    <span className="text-sm text-muted-foreground">{contrast}%</span>
                  </div>
                  <Slider
                    value={[contrast]}
                    onValueChange={(v) => setContrast(v[0])}
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Saturation</Label>
                    <span className="text-sm text-muted-foreground">{saturation}%</span>
                  </div>
                  <Slider
                    value={[saturation]}
                    onValueChange={(v) => setSaturation(v[0])}
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Highlights</Label>
                    <span className="text-sm text-muted-foreground">{highlights}</span>
                  </div>
                  <Slider
                    value={[highlights]}
                    onValueChange={(v) => setHighlights(v[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Shadows</Label>
                    <span className="text-sm text-muted-foreground">{shadows}</span>
                  </div>
                  <Slider
                    value={[shadows]}
                    onValueChange={(v) => setShadows(v[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Vibrance</Label>
                    <span className="text-sm text-muted-foreground">{vibrance}%</span>
                  </div>
                  <Slider
                    value={[vibrance]}
                    onValueChange={(v) => setVibrance(v[0])}
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Aesthetics Tab */}
            <TabsContent value="aesthetics" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="vignette">Vignette Effect</Label>
                    <Switch
                      id="vignette"
                      checked={vignetteEnabled}
                      onCheckedChange={setVignetteEnabled}
                    />
                  </div>
                  {vignetteEnabled && (
                    <div className="space-y-2 pl-4">
                      <div className="flex justify-between">
                        <Label className="text-sm">Intensity</Label>
                        <span className="text-sm text-muted-foreground">{vignetteIntensity}%</span>
                      </div>
                      <Slider
                        value={[vignetteIntensity]}
                        onValueChange={(v) => setVignetteIntensity(v[0])}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="filmgrain">Film Grain</Label>
                    <Switch
                      id="filmgrain"
                      checked={filmGrainEnabled}
                      onCheckedChange={setFilmGrainEnabled}
                    />
                  </div>
                  {filmGrainEnabled && (
                    <div className="space-y-2 pl-4">
                      <div className="flex justify-between">
                        <Label className="text-sm">Amount</Label>
                        <span className="text-sm text-muted-foreground">{filmGrainAmount}%</span>
                      </div>
                      <Slider
                        value={[filmGrainAmount]}
                        onValueChange={(v) => setFilmGrainAmount(v[0])}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Sharpen</Label>
                    <span className="text-sm text-muted-foreground">{sharpen}%</span>
                  </div>
                  <Slider
                    value={[sharpen]}
                    onValueChange={(v) => setSharpen(v[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Background Blur</Label>
                    <span className="text-sm text-muted-foreground">{blur}</span>
                  </div>
                  <Slider
                    value={[blur]}
                    onValueChange={(v) => setBlur(v[0])}
                    min={0}
                    max={10}
                    step={1}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Composition Tab */}
            <TabsContent value="composition" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Crop Ratio</Label>
                  <Select value={cropRatio} onValueChange={setCropRatio}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="4:5">4:5 (Instagram)</SelectItem>
                      <SelectItem value="21:9">21:9 (Cinematic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="safezones">Safe Zones</Label>
                    <p className="text-xs text-muted-foreground">
                      Add safe zone overlays for text placement
                    </p>
                  </div>
                  <Switch
                    id="safezones"
                    checked={safeZones}
                    onCheckedChange={setSafeZones}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="thirds">Rule of Thirds</Label>
                    <p className="text-xs text-muted-foreground">
                      Apply rule of thirds composition guides
                    </p>
                  </div>
                  <Switch
                    id="thirds"
                    checked={rulesOfThirds}
                    onCheckedChange={setRulesOfThirds}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {profile ? "Update Profile" : "Create Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
