"use client";

import { useState, useEffect } from "react";
import { BookOpen, Loader2, Plus, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDuration, cn } from "@/lib/utils";

interface Chapter {
  title: string;
  summary: string;
  startMs: number;
  endMs: number;
  durationSec: number;
  keywords: string[];
  topicCategory?: string;
}

interface ChapterSegmentationResult {
  chapters: Chapter[];
  totalChapters: number;
  totalDurationSec: number;
  analysisMethod: 'ai' | 'fallback';
  assetId: string;
  projectId: string;
}

interface ChapterTimelineProps {
  assetId: string;
  projectId?: string;
  durationMs: number;
  onChapterClick?: (chapter: Chapter) => void;
  onCreateClip?: (chapter: Chapter) => void;
}

export function ChapterTimeline({
  assetId,
  projectId,
  durationMs,
  onChapterClick,
  onCreateClip
}: ChapterTimelineProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [segmentation, setSegmentation] = useState<ChapterSegmentationResult | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);

  useEffect(() => {
    if (assetId) {
      loadChapters();
    }
  }, [assetId]);

  const loadChapters = async () => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Project required",
        description: "Cannot segment chapters without a project"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/repurpose/chapter-segmentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetId,
        })
      });

      if (!response.ok) {
        throw new Error("Chapter segmentation failed");
      }

      const apiResponse = await response.json();

      if (apiResponse.success && apiResponse.data) {
        setSegmentation(apiResponse.data);

        toast({
          title: "Chapters loaded",
          description: `Found ${apiResponse.data.totalChapters} chapters using ${apiResponse.data.analysisMethod === 'ai' ? 'AI analysis' : 'fallback method'}`
        });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to load chapters:", error);
      toast({
        variant: "destructive",
        title: "Failed to load chapters",
        description: "Please try again"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChapterClick = (chapter: Chapter, index: number) => {
    setSelectedChapterIndex(index);
    if (onChapterClick) {
      onChapterClick(chapter);
    }
  };

  const handleCreateClip = async (chapter: Chapter) => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Project required",
        description: "Cannot create clip without a project"
      });
      return;
    }

    if (onCreateClip) {
      onCreateClip(chapter);
    }
  };

  const getCategoryEmoji = (category?: string): string => {
    if (!category) return "📝";
    const emojiMap: Record<string, string> = {
      introduction: "👋",
      "main content": "📚",
      tutorial: "🎓",
      "q&a": "❓",
      conclusion: "🎯",
      discussion: "💬",
      demonstration: "👨‍🏫",
      interview: "🎙️"
    };
    return emojiMap[category.toLowerCase()] || "📝";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing video structure...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
        </CardContent>
      </Card>
    );
  }

  if (!segmentation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Chapter Timeline
          </CardTitle>
          <CardDescription>
            AI-powered chapter segmentation for better content organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadChapters} disabled={isLoading}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Analyze Chapters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Chapter Timeline
            <Badge variant="outline" className="ml-auto">
              {segmentation.totalChapters} chapters
            </Badge>
            {segmentation.analysisMethod === 'ai' && (
              <Badge variant="secondary" className="text-xs">
                AI-Powered
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Video automatically segmented into {segmentation.totalChapters} logical chapters
            {segmentation.analysisMethod === 'fallback' && " using time-based segmentation"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual Timeline */}
          <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
            {segmentation.chapters.map((chapter, idx) => {
              const widthPercent = ((chapter.endMs - chapter.startMs) / durationMs) * 100;
              const leftPercent = (chapter.startMs / durationMs) * 100;
              const isSelected = idx === selectedChapterIndex;

              return (
                <div
                  key={idx}
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-background cursor-pointer transition-all hover:opacity-80",
                    isSelected ? "ring-2 ring-primary ring-offset-2 bg-primary" : "bg-muted-foreground/50"
                  )}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`
                  }}
                  onClick={() => handleChapterClick(chapter, idx)}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chapter Cards */}
          <div className="space-y-3">
            {segmentation.chapters.map((chapter, idx) => {
              const isSelected = idx === selectedChapterIndex;
              const duration = chapter.endMs - chapter.startMs;

              return (
                <Card
                  key={idx}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary",
                    isSelected ? "border-primary bg-primary/5" : ""
                  )}
                  onClick={() => handleChapterClick(chapter, idx)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-muted-foreground">
                            Ch {idx + 1}
                          </span>
                          {chapter.topicCategory && (
                            <Badge variant="secondary" className="text-xs">
                              {getCategoryEmoji(chapter.topicCategory)} {chapter.topicCategory}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {chapter.durationSec}s
                          </span>
                        </div>
                        <h4 className="font-medium mb-1">{chapter.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                          {chapter.summary}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatDuration(chapter.startMs)} → {formatDuration(chapter.endMs)}
                          </span>
                        </div>
                      </div>
                      {projectId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateClip(chapter);
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Clip
                        </Button>
                      )}
                    </div>

                    {/* Keywords */}
                    {chapter.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {chapter.keywords.slice(0, 5).map((keyword, kidx) => (
                          <Badge key={kidx} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Analysis Info */}
          <div className="rounded-lg border bg-muted/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground mb-1">Analysis Method</p>
                <p className="text-muted-foreground">
                  {segmentation.analysisMethod === 'ai' ? 'AI-Powered Topic Detection' : 'Time-Based Segmentation'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground mb-1">Total Duration</p>
                <p className="text-muted-foreground">
                  {Math.floor(segmentation.totalDurationSec / 60)}m {segmentation.totalDurationSec % 60}s
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
