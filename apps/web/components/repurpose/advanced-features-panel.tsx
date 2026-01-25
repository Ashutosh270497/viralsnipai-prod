"use client";

import { useState } from "react";
import { Sparkles, Palette, BookOpen, Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NaturalLanguageSearch } from "./natural-language-search";
import { CaptionStyleSelector } from "./caption-style-selector";
import { ChapterTimeline } from "./chapter-timeline";
import { CompositeClipBuilder } from "./composite-clip-builder";

interface AdvancedFeaturesPanelProps {
  assetId?: string;
  projectId?: string;
  durationMs?: number;
  onFeaturesUsed?: () => void;
}

export function AdvancedFeaturesPanel({
  assetId,
  projectId,
  durationMs,
  onFeaturesUsed
}: AdvancedFeaturesPanelProps) {
  const [activeTab, setActiveTab] = useState("search");

  if (!assetId) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Upload a video to unlock advanced features
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border/40 px-6 pt-6">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="chapters" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Chapters</span>
            </TabsTrigger>
            <TabsTrigger value="composite" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Composite</span>
            </TabsTrigger>
            <TabsTrigger value="captions" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Captions</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="pt-6">
          <TabsContent value="search" className="mt-0">
            <NaturalLanguageSearch
              assetId={assetId}
              projectId={projectId}
              onClipsGenerated={onFeaturesUsed}
            />
          </TabsContent>

          <TabsContent value="chapters" className="mt-0">
            <ChapterTimeline
              assetId={assetId}
              projectId={projectId}
              durationMs={durationMs || 0}
              onCreateClip={() => {
                if (onFeaturesUsed) onFeaturesUsed();
              }}
            />
          </TabsContent>

          <TabsContent value="composite" className="mt-0">
            <CompositeClipBuilder
              assetId={assetId}
              projectId={projectId}
              onCompositeCreated={() => {
                if (onFeaturesUsed) onFeaturesUsed();
              }}
            />
          </TabsContent>

          <TabsContent value="captions" className="mt-0">
            <CaptionStyleSelector
              onStyleApplied={onFeaturesUsed}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
