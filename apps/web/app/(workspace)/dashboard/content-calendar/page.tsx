"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Calendar as CalendarIcon, Loader2, Sparkles, Trash2, Download, Grid3x3, List, LayoutGrid, BarChart3 } from "lucide-react";
import { CalendarView } from "@/components/content-calendar/calendar-view";
import { ListView } from "@/components/content-calendar/list-view";
import { BoardView } from "@/components/content-calendar/board-view";
import { IdeaDetailModal } from "@/components/content-calendar/idea-detail-modal";
import { GenerateCalendarForm } from "@/components/content-calendar/generate-calendar-form";
import { CalendarFilters } from "@/components/content-calendar/calendar-filters";
import { ContentMixChart } from "@/components/content-calendar/content-mix-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VideoIdea, CalendarFilters as CalendarFiltersType } from "@/lib/types/content-calendar";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/utils/export-calendar";

interface ContentCalendar {
  id: string;
  niche: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  generationStatus: string;
  ideas: VideoIdea[];
  createdAt: string;
}

type ViewMode = "calendar" | "list" | "board";

export default function ContentCalendarPage() {
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerateFormOpen, setIsGenerateFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [filters, setFilters] = useState<CalendarFiltersType>({});
  const [showStats, setShowStats] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all calendars
  const { data: calendars, isLoading } = useQuery<ContentCalendar[]>({
    queryKey: ["content-calendars"],
    queryFn: async () => {
      const res = await fetch("/api/content-calendar");
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const data = await res.json();
      return data.calendars;
    },
  });

  // Delete calendar mutation
  const deleteMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch(`/api/content-calendar/${calendarId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete calendar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-calendars"] });
      toast({
        title: "Calendar Deleted",
        description: "Your content calendar has been deleted successfully.",
      });
      if (selectedCalendar) {
        setSelectedCalendar(null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const activeCalendar = calendars?.find((cal) => cal.id === selectedCalendar);

  // Filter ideas based on active filters
  const filteredIdeas = useMemo(() => {
    if (!activeCalendar) return [];

    return activeCalendar.ideas.filter((idea) => {
      if (filters.videoType && idea.videoType !== filters.videoType) return false;
      if (filters.contentCategory && idea.contentCategory !== filters.contentCategory) return false;
      if (filters.status && idea.status !== filters.status) return false;
      if (filters.minViralityScore && (idea.viralityScore || 0) < filters.minViralityScore) return false;
      return true;
    });
  }, [activeCalendar, filters]);

  const handleIdeaClick = (idea: VideoIdea) => {
    setSelectedIdea(idea);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!activeCalendar) return;
    exportToCSV(filteredIdeas, `${activeCalendar.niche}-content-calendar`);
    toast({
      title: "Export Successful",
      description: "Your content calendar has been exported to CSV.",
    });
  };

  // Auto-schedule mutation
  const autoScheduleMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch(`/api/content-calendar/${calendarId}/auto-schedule`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to auto-schedule");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["content-calendars"] });
      toast({
        title: "Auto-Schedule Complete",
        description: `${data.ideasScheduled} ideas have been optimally distributed across your calendar.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to auto-schedule calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAutoSchedule = () => {
    if (!activeCalendar) return;
    if (confirm("Automatically distribute all ideas across the calendar for optimal scheduling?")) {
      autoScheduleMutation.mutate(activeCalendar.id);
    }
  };

  const handleDeleteCalendar = (calendarId: string) => {
    if (confirm("Are you sure you want to delete this calendar? This action cannot be undone.")) {
      deleteMutation.mutate(calendarId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground">
            AI-generated video ideas scheduled for maximum growth
          </p>
        </div>
        <Button size="lg" onClick={() => setIsGenerateFormOpen(true)}>
          <Plus className="mr-2 h-5 w-5" />
          Generate Calendar
        </Button>
      </div>

      {calendars && calendars.length === 0 ? (
        // Empty State
        <Card className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">Generate Your First Content Calendar</h3>
          <p className="mb-6 max-w-md text-muted-foreground">
            Get 30 days of AI-powered video ideas tailored to your niche. Each idea includes
            virality scores, keywords, hooks, and thumbnail concepts.
          </p>
          <Button size="lg" onClick={() => setIsGenerateFormOpen(true)}>
            <Sparkles className="mr-2 h-5 w-5" />
            Create 30-Day Calendar
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:gap-6 xl:grid-cols-[300px_1fr_320px]">
          {/* Left Sidebar - Calendar List */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Your Calendars</h2>
            <div className="space-y-2">
              {calendars?.map((calendar) => (
                <Card
                  key={calendar.id}
                  className={`cursor-pointer p-3 transition-all hover:border-primary/50 hover:shadow-sm ${
                    selectedCalendar === calendar.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                  onClick={() => setSelectedCalendar(calendar.id)}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-semibold">{calendar.niche}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCalendar(calendar.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="truncate">
                      {format(new Date(calendar.startDate), "MMM d")} -{" "}
                      {format(new Date(calendar.endDate), "MMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {calendar.durationDays} days
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {calendar.ideas.length} ideas
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Main Content - Calendar View */}
          <div className="space-y-4">
            {activeCalendar ? (
              <>
                {/* Header with View Switcher */}
                <Card className="p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="mb-1 truncate text-xl font-bold lg:text-2xl">{activeCalendar.niche}</h2>
                      <p className="text-xs text-muted-foreground lg:text-sm">
                        {format(new Date(activeCalendar.startDate), "MMM d")} -{" "}
                        {format(new Date(activeCalendar.endDate), "MMM d, yyyy")} •{" "}
                        <span className="font-medium">{filteredIdeas.length}</span> of {activeCalendar.ideas.length} ideas
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="flex rounded-lg border">
                        <Button
                          variant={viewMode === "calendar" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("calendar")}
                          className="h-8 rounded-r-none px-2"
                          title="Calendar View"
                        >
                          <Grid3x3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="h-8 rounded-none border-x px-2"
                          title="List View"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "board" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("board")}
                          className="h-8 rounded-l-none px-2"
                          title="Board View"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Auto-Schedule Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoSchedule}
                        disabled={autoScheduleMutation.isPending}
                        className="h-8"
                      >
                        {autoScheduleMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            <span className="hidden sm:inline">Scheduling...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">Auto-Schedule</span>
                          </>
                        )}
                      </Button>

                      {/* Export Button */}
                      <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8">
                        <Download className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Export</span>
                      </Button>

                      {/* Stats Toggle */}
                      <Button
                        variant={showStats ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowStats(!showStats)}
                        className="h-8"
                      >
                        <BarChart3 className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Stats</span>
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Conditional Stats Display */}
                {showStats && (
                  <div className="grid grid-cols-3 gap-3">
                    {/* Quick Stats */}
                    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-3">
                      <div className="text-xs font-medium text-muted-foreground">Total Ideas</div>
                      <div className="mt-1 text-2xl font-bold">{activeCalendar.ideas.length}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-gradient-to-br dark:from-green-500/5 dark:to-green-500/10 p-3">
                      <div className="text-xs font-medium text-muted-foreground">Avg Virality</div>
                      <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {Math.round(
                          activeCalendar.ideas.reduce((sum, idea) => sum + (idea.viralityScore || 0), 0) /
                            activeCalendar.ideas.length
                        )}
                        <span className="text-base">/100</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-gradient-to-br dark:from-blue-500/5 dark:to-blue-500/10 p-3">
                      <div className="text-xs font-medium text-muted-foreground">Est. Total Views</div>
                      <div className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {(
                          activeCalendar.ideas.reduce((sum, idea) => sum + (idea.estimatedViews || 0), 0) / 1000
                        ).toFixed(0)}
                        <span className="text-base">K</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Content Area */}
                <Card className="p-4 lg:p-6">
                  {viewMode === "calendar" && (
                    <CalendarView
                      ideas={filteredIdeas}
                      selectedDate={new Date(activeCalendar.startDate)}
                      onIdeaClick={handleIdeaClick}
                    />
                  )}
                  {viewMode === "list" && <ListView ideas={filteredIdeas} onIdeaClick={handleIdeaClick} />}
                  {viewMode === "board" && <BoardView ideas={filteredIdeas} onIdeaClick={handleIdeaClick} />}
                </Card>
              </>
            ) : (
              <Card className="flex min-h-[400px] items-center justify-center p-12 text-center">
                <div>
                  <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Select a calendar from the sidebar to view your content plan
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Right Sidebar - Filters & Stats */}
          {activeCalendar && (
            <div className="space-y-4">
              <Card className="p-4">
                <CalendarFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  resultCount={filteredIdeas.length}
                />
              </Card>

              <ContentMixChart ideas={filteredIdeas} />
            </div>
          )}
        </div>
      )}

      {/* Idea Detail Modal */}
      <IdeaDetailModal
        idea={selectedIdea}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["content-calendars"] })}
      />

      {/* Generate Calendar Form */}
      <GenerateCalendarForm
        open={isGenerateFormOpen}
        onOpenChange={setIsGenerateFormOpen}
      />
    </div>
  );
}
