"use client";

import { ChangeEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { CaptionStylePicker } from "@/components/brand-kit/caption-style-picker";

interface BrandKitFormProps {
  initial: {
    primaryHex: string;
    fontFamily: string;
    logoPath?: string | null;
    logoStoragePath?: string | null;
    watermark: boolean;
    captionStyle: {
      karaoke: boolean;
      outline: boolean;
      position: "bottom" | "top" | "middle";
    };
  };
  canToggleWatermark: boolean;
}

export function BrandKitForm({ initial, canToggleWatermark }: BrandKitFormProps) {
  const { toast } = useToast();
  const [primaryHex, setPrimaryHex] = useState(initial.primaryHex ?? "#9333ea");
  const [fontFamily, setFontFamily] = useState(initial.fontFamily ?? "Inter");
  const watermarkLocked = !canToggleWatermark;
  const [watermark, setWatermark] = useState(
    canToggleWatermark ? initial.watermark ?? true : true
  );
  const [logoPath, setLogoPath] = useState<string | null>(initial.logoPath ?? null);
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(initial.logoStoragePath ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [captionStyle, setCaptionStyle] = useState(initial.captionStyle);
  const [isSaving, setIsSaving] = useState(false);

  const systemFonts = ["Inter", "Arial", "Helvetica", "Satoshi", "Poppins", "DM Sans"];

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? [];
    if (file) {
      setLogoFile(file);
    }
  };

  async function handleSubmit() {
    setIsSaving(true);

    try {
      let nextLogoPath = logoPath;
      let nextLogoStoragePath = logoStoragePath;
      const nextWatermarkState = watermarkLocked ? true : watermark;

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        const uploadResponse = await fetch("/api/brand-kit/logo", {
          method: "POST",
          body: formData,
          cache: "no-store",
          next: { revalidate: 0 }
        });
        if (!uploadResponse.ok) {
          throw new Error("Logo upload failed");
        }
        const uploadJson = await uploadResponse.json();
        nextLogoPath = uploadJson.logoPath;
        nextLogoStoragePath = uploadJson.logoStoragePath;
        setLogoPath(nextLogoPath);
        setLogoStoragePath(nextLogoStoragePath);
      }

      const response = await fetch("/api/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryHex,
          fontFamily,
          watermark: nextWatermarkState,
          captionStyle,
          logoPath: nextLogoPath,
          logoStoragePath: nextLogoStoragePath
        }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error("Unable to save brand kit");
      }

      toast({ title: "Brand kit saved", description: "Your exports will now use these settings." });
      if (watermarkLocked && !watermark) {
        setWatermark(true);
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Could not save brand kit",
        description: "Please try again"
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="max-w-3xl border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
      <CardHeader>
        <CardTitle>Brand settings</CardTitle>
        <CardDescription>Customize captions, color, fonts, and watermark defaults.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex-1 space-y-2">
            <Label htmlFor="primaryHex">Primary color</Label>
            <Input id="primaryHex" type="color" value={primaryHex} onChange={(event) => setPrimaryHex(event.target.value)} />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="fontFamily">Font family</Label>
            <select
              id="fontFamily"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={fontFamily}
              onChange={(event) => setFontFamily(event.target.value)}
            >
              {systemFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo">Logo</Label>
          <Input id="logo" type="file" accept="image/*" onChange={handleLogoChange} />
          {logoPath ? (
            <p className="text-xs text-muted-foreground">Current logo: {logoPath}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Watermark</p>
            <p className="text-xs text-muted-foreground">
              Overlay a subtle watermark on exports to reinforce your brand.
            </p>
            {watermarkLocked ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Watermark is required on the Free plan. Upgrade to unlock custom controls.
              </p>
            ) : null}
          </div>
          <Switch
            disabled={watermarkLocked}
            checked={watermark}
            onCheckedChange={canToggleWatermark ? setWatermark : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label>Caption style</Label>
          <CaptionStylePicker value={captionStyle} onChange={setCaptionStyle} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={isSaving} className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700">
          {isSaving ? "Saving..." : "Save brand kit"}
        </Button>
      </CardFooter>
    </Card>
  );
}
