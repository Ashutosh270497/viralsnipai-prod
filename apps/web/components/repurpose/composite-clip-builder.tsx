"use client";

import { useState, useEffect } from "react";
import { Layers, Loader2, Plus, X, Flame, Zap, Info } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDuration, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompositeSegment {
  id: string;
  startMs: number;
  endMs: number;
  transcript: string;
  viralityScore?: number;
  purpose: "hook" | "context" | "payoff" | "example" | "transition" | "cta";
}

interface CompositeClip {
  segments: CompositeSegment[];
  transitions: Array<{
    type: "cut" | "fade" | "dissolve" | "wipe";
    durationMs: number;
    position: number;
  }>;
  totalDurationMs: number;
  title: string;
  summary: string;
  viralityScore: number;
  compositionReason: string;
  strategy: string;
}

interface CompositeClipBuilderProps {
  assetId: string;
  projectId?: string;
  onCompositeCreated?: (composite: CompositeClip) => void;
}

const COMPOSITION_STRATEGIES = [
  {
    id: "problem-solution",
    name: "Problem → Solution",
    description: "Identify problem and deliver solution",
    icon: "🎯"
  },
  {
    id: "setup-payoff",
    name: "Setup → Payoff",
    description: "Story with powerful punchline",
    icon: "💥"
  },
  {
    id: "multi-example",
    name: "Multiple Examples",
    description: "Stitch 2-3 tips together",
    icon: "📝"
  },
  {
    id: "question-answer",
    name: "Q&A",
    description: "Question posed → Answer delivered",
    icon: "❓"
  },
  {
    id: "before-after",
    name: "Before → After",
    description: "Transformation story",
    icon: "✨"
  },
  {
    id: "sequential",
    name: "Sequential Steps",
    description: "Step-by-step process",
    icon: "🔢"
  }
];

function SortableSegment({
  segment,
  index,
  onRemove
}: {
  segment: CompositeSegment;
  index: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getPurposeColor = (purpose: string) => {
    const colors: Record<string, string> = {
      hook: "bg-purple-500",
      context: "bg-blue-500",
      payoff: "bg-green-500",
      example: "bg-yellow-500",
      transition: "bg-gray-500",
      cta: "bg-red-500"
    };
    return colors[purpose] || "bg-gray-500";
  };

  return (
    <Card ref={setNodeRef} style={style} className="cursor-grab active:cursor-grabbing">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div {...attributes} {...listeners} className="mt-1">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-mono text-sm">
              {index + 1}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-white", getPurposeColor(segment.purpose))}>
                {segment.purpose}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDuration(segment.startMs)} → {formatDuration(segment.endMs)}
              </span>
              {segment.viralityScore && (
                <Badge variant="outline">
                  <Flame className="mr-1 h-3 w-3" />
                  {segment.viralityScore}
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed line-clamp-2">{segment.transcript}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompositeClipBuilder({ assetId, projectId, onCompositeCreated }: CompositeClipBuilderProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [strategy, setStrategy] = useState<string>("problem-solution");
  const [opportunities, setOpportunities] = useState<CompositeClip[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<CompositeSegment[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewComposite, setPreviewComposite] = useState<CompositeClip | null>(null);

  const findOpportunities = async () => {
    setIsLoading(true);

    try {
      // This would call the cross-scene clips API
      // For now, we'll simulate with mock data
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock composite opportunities
      const mockOpportunities: CompositeClip[] = [
        {
          segments: [
            {
              id: "seg1",
              startMs: 45000,
              endMs: 60000,
              transcript: "The biggest problem I see creators facing is inconsistent content quality...",
              viralityScore: 72,
              purpose: "context"
            },
            {
              id: "seg2",
              startMs: 300000,
              endMs: 315000,
              transcript: "Here's the exact 3-step system that solved this for me: First, create templates...",
              viralityScore: 88,
              purpose: "payoff"
            }
          ],
          transitions: [
            { type: "dissolve", durationMs: 400, position: 15000 }
          ],
          totalDurationMs: 30400,
          title: "Problem to Solution",
          summary: "Identifies content quality problem and delivers 3-step solution",
          viralityScore: 85,
          compositionReason: "Combined 2 segments using problem-solution strategy",
          strategy: "problem-solution"
        },
        {
          segments: [
            {
              id: "seg3",
              startMs: 120000,
              endMs: 132000,
              transcript: "I was making $3k per month, struggling to pay rent...",
              viralityScore: 78,
              purpose: "hook"
            },
            {
              id: "seg4",
              startMs: 450000,
              endMs: 465000,
              transcript: "Now I'm at $50k monthly, and here's exactly what changed...",
              viralityScore: 92,
              purpose: "payoff"
            }
          ],
          transitions: [
            { type: "cut", durationMs: 0, position: 12000 }
          ],
          totalDurationMs: 27000,
          title: "Before & After Transformation",
          summary: "$3k to $50k transformation story with specific numbers",
          viralityScore: 90,
          compositionReason: "Combined 2 segments using before-after strategy",
          strategy: "before-after"
        },
        {
          segments: [
            {
              id: "seg5",
              startMs: 180000,
              endMs: 195000,
              transcript: "First tip: Batch create content on Sundays. This saves 10+ hours per week...",
              viralityScore: 75,
              purpose: "example"
            },
            {
              id: "seg6",
              startMs: 250000,
              endMs: 262000,
              transcript: "Second: Use AI for thumbnails. I use this exact prompt...",
              viralityScore: 80,
              purpose: "example"
            },
            {
              id: "seg7",
              startMs: 330000,
              endMs: 345000,
              transcript: "Third: Schedule posts when your audience is most active. Check analytics...",
              viralityScore: 77,
              purpose: "example"
            }
          ],
          transitions: [
            { type: "fade", durationMs: 400, position: 15000 },
            { type: "fade", durationMs: 400, position: 27400 }
          ],
          totalDurationMs: 42800,
          title: "3 Powerful Creator Tips",
          summary: "Three actionable examples stitched together for maximum value",
          viralityScore: 82,
          compositionReason: "Combined 3 segments using multi-example strategy",
          strategy: "multi-example"
        }
      ];

      // Filter by selected strategy
      const filtered = mockOpportunities.filter(
        opp => opp.strategy === strategy
      );

      setOpportunities(filtered);

      toast({
        title: "Opportunities found",
        description: `Found ${filtered.length} composite clip opportunities`
      });
    } catch (error) {
      console.error("Failed to find opportunities:", error);
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: "Please try again"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = selectedSegments.findIndex(seg => seg.id === active.id);
    const newIndex = selectedSegments.findIndex(seg => seg.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...selectedSegments];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    setSelectedSegments(newOrder);
  };

  const handlePreview = (composite: CompositeClip) => {
    setPreviewComposite(composite);
    setShowPreview(true);
  };

  const handleCreate = async (composite: CompositeClip) => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Project required",
        description: "Cannot create composite clip without a project"
      });
      return;
    }

    try {
      toast({
        title: "Creating composite clip",
        description: "This may take a moment..."
      });

      // This would call API to create the composite clip
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: "Composite clip created",
        description: `"${composite.title}" has been added to your clips`
      });

      if (onCompositeCreated) {
        onCompositeCreated(composite);
      }
    } catch (error) {
      console.error("Failed to create composite:", error);
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: "Please try again"
      });
    }
  };

  const currentStrategy = COMPOSITION_STRATEGIES.find(s => s.id === strategy);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Composite Clip Builder
          </CardTitle>
          <CardDescription>
            Combine multiple moments from different parts of your video into cohesive clips
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Composition Strategy</label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPOSITION_STRATEGIES.map((strat) => (
                  <SelectItem key={strat.id} value={strat.id}>
                    {strat.icon} {strat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentStrategy && (
              <p className="text-xs text-muted-foreground">
                {currentStrategy.description}
              </p>
            )}
          </div>

          <Button onClick={findOpportunities} disabled={isLoading} className="w-full">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Find Opportunities
          </Button>
        </CardContent>
      </Card>

      {/* Opportunities List */}
      {opportunities.length > 0 && (
        <div className="space-y-3">
          {opportunities.map((opportunity, idx) => (
            <Card key={idx} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {opportunity.title}
                      <Badge className="bg-green-500">
                        <Flame className="mr-1 h-3 w-3" />
                        {opportunity.viralityScore}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{opportunity.summary}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(opportunity)}
                  >
                    <Info className="mr-2 h-3 w-3" />
                    Preview
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Segments Preview */}
                <div className="space-y-2">
                  {opportunity.segments.map((segment, sidx) => (
                    <div key={sidx} className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="w-16 justify-center">
                        {segment.purpose}
                      </Badge>
                      <span className="text-muted-foreground line-clamp-1 flex-1">
                        {segment.transcript}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDuration(segment.endMs - segment.startMs)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>{opportunity.segments.length} segments</span>
                  <span>•</span>
                  <span>{formatDuration(opportunity.totalDurationMs)} total</span>
                  <span>•</span>
                  <span>{opportunity.transitions.length} transitions</span>
                </div>

                {projectId && (
                  <Button
                    size="sm"
                    onClick={() => handleCreate(opportunity)}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Composite Clip
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manual Builder (if segments selected) */}
      {selectedSegments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Composition</CardTitle>
            <CardDescription>Drag to reorder segments</CardDescription>
          </CardHeader>
          <CardContent>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedSegments.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {selectedSegments.map((segment, index) => (
                    <SortableSegment
                      key={segment.id}
                      segment={segment}
                      index={index}
                      onRemove={() => {
                        setSelectedSegments(selectedSegments.filter(s => s.id !== segment.id));
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewComposite?.title}</DialogTitle>
            <DialogDescription>{previewComposite?.summary}</DialogDescription>
          </DialogHeader>
          {previewComposite && (
            <div className="space-y-4">
              {/* Timeline Visualization */}
              <div className="space-y-2">
                {previewComposite.segments.map((segment, idx) => (
                  <div key={idx} className="space-y-1">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{segment.purpose}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(segment.startMs)} - {formatDuration(segment.endMs)}
                          </span>
                        </div>
                        <p className="text-sm">{segment.transcript}</p>
                      </CardContent>
                    </Card>
                    {idx < previewComposite.segments.length - 1 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
                        <div className="h-px w-8 bg-border" />
                        <span className="capitalize">
                          {previewComposite.transitions[idx]?.type} transition
                          ({previewComposite.transitions[idx]?.durationMs}ms)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{previewComposite.segments.length}</p>
                  <p className="text-xs text-muted-foreground">Segments</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatDuration(previewComposite.totalDurationMs)}</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{previewComposite.viralityScore}</p>
                  <p className="text-xs text-muted-foreground">Virality Score</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  handleCreate(previewComposite);
                  setShowPreview(false);
                }}
                className="w-full"
                disabled={!projectId}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create This Composite
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
