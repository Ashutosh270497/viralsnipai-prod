"use client";

import { format } from "date-fns";
import { TrendingUp, Eye, Calendar } from "lucide-react";
import { VideoIdea, IdeaStatus } from "@/lib/types/content-calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BoardViewProps {
  ideas: VideoIdea[];
  onIdeaClick: (idea: VideoIdea) => void;
}

export function BoardView({ ideas, onIdeaClick }: BoardViewProps) {
  const columns: { status: IdeaStatus; label: string; color: string; countColor: string; icon: string }[] = [
    { status: "idea", label: "Ideas", color: "border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5", countColor: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: "💡" },
    { status: "scripted", label: "Scripted", color: "border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5", countColor: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400", icon: "📝" },
    { status: "published", label: "Published", color: "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5", countColor: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: "✅" },
  ];

  const getIdeasByStatus = (status: IdeaStatus) => {
    return ideas.filter((idea) => idea.status === status);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "trending":
        return "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-600 border-red-300 dark:border-red-500/20";
      case "evergreen":
        return "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-600 border-green-300 dark:border-green-500/20";
      case "experimental":
        return "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-600 border-purple-300 dark:border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getViralityColor = (score: number) => {
    if (score >= 80) return "text-red-600 dark:text-red-500";
    if (score >= 50) return "text-amber-600 dark:text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {columns.map((column) => {
        const columnIdeas = getIdeasByStatus(column.status);

        return (
          <div key={column.status} className="flex flex-col">
            {/* Column Header */}
            <div className={cn("mb-3 rounded-lg border p-3", column.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{column.icon}</span>
                  <h3 className="font-semibold">{column.label}</h3>
                </div>
                <span className={cn("inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-semibold", column.countColor)}>
                  {columnIdeas.length}
                </span>
              </div>
            </div>

            {/* Column Cards */}
            <div className="flex-1 space-y-3">
              {columnIdeas.map((idea) => (
                <Card
                  key={idea.id}
                  className="cursor-pointer border border-border dark:border-white/[0.07] p-3 transition-all hover:shadow-md hover:ring-1 hover:ring-primary/30 dark:hover:ring-primary/20"
                  onClick={() => onIdeaClick(idea)}
                >
                  <div className="space-y-2">
                    {/* Title */}
                    <h4 className="text-sm font-semibold leading-tight line-clamp-2">
                      {idea.title}
                    </h4>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1">
                      <Badge className={cn("border text-xs", getCategoryColor(idea.contentCategory || ""))}>
                        {idea.contentCategory}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {idea.videoType === "short" ? "🎬" : "📺"}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className={cn("font-semibold", getViralityColor(idea.viralityScore || 0))}>
                          {idea.viralityScore}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        <span>{(idea.estimatedViews || 0) >= 1000 ? `${Math.floor((idea.estimatedViews || 0) / 1000)}K` : idea.estimatedViews}</span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(idea.scheduledDate), "MMM d")}</span>
                    </div>
                  </div>
                </Card>
              ))}

              {columnIdeas.length === 0 && (
                <Card className="border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">No {column.label.toLowerCase()}</p>
                </Card>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
