"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, min, max } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoIdea } from "@/lib/types/content-calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CalendarViewProps {
  ideas: VideoIdea[];
  selectedDate?: Date;
  onDateClick?: (date: Date) => void;
  onIdeaClick?: (idea: VideoIdea) => void;
}

export function CalendarView({ ideas, selectedDate, onDateClick, onIdeaClick }: CalendarViewProps) {
  // Calculate date range from ideas
  const dateRange = useMemo(() => {
    if (ideas.length === 0) {
      return { start: new Date(), end: new Date() };
    }
    const dates = ideas.map(idea => new Date(idea.scheduledDate));
    return {
      start: min(dates),
      end: max(dates)
    };
  }, [ideas]);

  const [currentMonth, setCurrentMonth] = useState(dateRange.start);

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group ideas by date
  const ideasByDate = ideas.reduce((acc, idea) => {
    const dateKey = format(new Date(idea.scheduledDate), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(idea);
    return acc;
  }, {} as Record<string, VideoIdea[]>);

  const getViralityIcon = (score: number) => {
    if (score >= 80) return "🔥";
    if (score >= 50) return "⭐";
    return "📝";
  };

  const getFormatIcon = (videoType: string) => {
    return videoType === "short" ? "🎬" : "📺";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "trending":
        return "bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20 text-red-700 dark:text-red-600";
      case "evergreen":
        return "bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20 text-green-700 dark:text-green-600";
      case "experimental":
        return "bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20 text-purple-700 dark:text-purple-600";
      default:
        return "bg-muted border-border text-muted-foreground";
    }
  };

  const goToPreviousMonth = () => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentMonth(prevMonth);
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };

  return (
    <div className="w-full">
      {/* Calendar Header with Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Labels */}
      <div className="mb-2 grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayIdeas = ideasByDate[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasIdeas = dayIdeas.length > 0;

          return (
            <Card
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] p-2 transition-all cursor-pointer",
                hasIdeas && "hover:shadow-md hover:border-primary/30",
                !isCurrentMonth && "opacity-30 bg-muted/30",
                isSelected && "ring-2 ring-primary",
                hasIdeas && isCurrentMonth && "bg-accent/5"
              )}
              onClick={() => onDateClick?.(day)}
            >
              {/* Date Number */}
              <div className={cn(
                "mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium",
                isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                hasIdeas && isCurrentMonth && "bg-primary/10 text-primary font-semibold"
              )}>
                {format(day, "d")}
              </div>

              {/* Video Ideas */}
              <div className="space-y-1">
                {dayIdeas.slice(0, 3).map((idea, idx) => (
                  <div
                    key={idea.id}
                    className={cn(
                      "group relative rounded-md border p-1.5 text-xs transition-all hover:scale-[1.02] cursor-pointer",
                      getCategoryColor(idea.contentCategory || "")
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onIdeaClick?.(idea);
                    }}
                  >
                    <div className="flex items-start gap-1">
                      <div className="flex gap-0.5 shrink-0 text-xs">
                        <span>{getViralityIcon(idea.viralityScore || 0)}</span>
                        <span>{getFormatIcon(idea.videoType || "long-form")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium leading-tight text-[10px]">
                          {idea.title}
                        </div>
                        <div className="mt-0.5 text-[9px] text-muted-foreground">
                          {idea.viralityScore}/100
                        </div>
                      </div>
                    </div>

                    {/* Hover Preview */}
                    <div className="absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-lg border bg-popover p-3 shadow-xl group-hover:block">
                      <div className="space-y-2">
                        <div className="font-semibold text-sm">{idea.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-3">
                          {idea.description}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Virality:</span>
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold">
                              {idea.viralityScore}/100
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Views:</span>
                            <span className="font-semibold">{((idea.estimatedViews || 0) / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {idea.keywords?.slice(0, 3).map((keyword, i) => (
                            <span key={i} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show count if more than 3 ideas */}
                {dayIdeas.length > 3 && (
                  <div className="rounded bg-muted px-1.5 py-1 text-center text-[10px] font-medium text-muted-foreground">
                    +{dayIdeas.length - 3} more
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
