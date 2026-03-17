"use client";

import { format } from "date-fns";
import { TrendingUp, Eye, Calendar } from "lucide-react";
import { VideoIdea } from "@/lib/types/content-calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ListViewProps {
  ideas: VideoIdea[];
  onIdeaClick: (idea: VideoIdea) => void;
}

export function ListView({ ideas, onIdeaClick }: ListViewProps) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return "✅";
      case "scripted":
        return "📝";
      default:
        return "💡";
    }
  };

  // Sort ideas by scheduled date
  const sortedIdeas = [...ideas].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedIdeas.map((idea) => (
        <Card
          key={idea.id}
          className="cursor-pointer border border-border dark:border-white/[0.07] p-4 transition-all hover:shadow-md hover:ring-1 hover:ring-primary/30 dark:hover:ring-primary/20"
          onClick={() => onIdeaClick(idea)}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Main Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">{getStatusIcon(idea.status)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold leading-tight">{idea.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {idea.description}
                  </p>
                </div>
              </div>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border text-xs", getCategoryColor(idea.contentCategory || ""))}>
                  {idea.contentCategory}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {idea.videoType === "short" ? "🎬 Short" : "📺 Long-form"}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(idea.scheduledDate), "MMM d, yyyy")}
                </div>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1">
                {idea.keywords?.slice(0, 3).map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {idea.keywords && idea.keywords.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{idea.keywords.length - 3} more
                  </span>
                )}
              </div>
            </div>

            {/* Stats Column */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex flex-col items-center rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className={cn("text-xl font-bold", getViralityColor(idea.viralityScore || 0))}>
                    {idea.viralityScore}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Virality</span>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  <span>{idea.estimatedViews?.toLocaleString()} est.</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {sortedIdeas.length === 0 && (
        <Card className="flex min-h-[200px] items-center justify-center p-8 text-center">
          <div>
            <p className="text-muted-foreground">No ideas match the current filters</p>
          </div>
        </Card>
      )}
    </div>
  );
}
