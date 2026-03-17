"use client";

import { FileText, TrendingUp, Image as ImageIcon, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecentActivityItem } from "@/types/dashboard";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface RecentActivityListProps {
  activities: RecentActivityItem[];
}

const activityIcons = {
  idea: Lightbulb,
  script: FileText,
  title: TrendingUp,
  thumbnail: ImageIcon,
};

const activityColors = {
  idea: "text-purple-600",
  script: "text-blue-600",
  title: "text-green-600",
  thumbnail: "text-orange-600",
};

const statusColors = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  scripted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export function RecentActivityList({ activities }: RecentActivityListProps) {
  const router = useRouter();

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No activity yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first content idea to get started
        </p>
        <Button
          className="mt-4"
          onClick={() => router.push("/dashboard/content-calendar")}
        >
          Create Content Idea
        </Button>
      </Card>
    );
  }

  const handleGenerateScript = (activity: RecentActivityItem) => {
    const params = new URLSearchParams({
      ideaId: activity.id,
      title: activity.title,
      niche: activity.niche || 'general',
    });
    router.push(`/dashboard/script-generator?${params.toString()}`);
  };

  const handleGenerateTitle = (activity: RecentActivityItem) => {
    const params = new URLSearchParams({
      contentIdeaId: activity.id,
      topic: activity.title,
    });
    router.push(`/dashboard/title-generator?${params.toString()}`);
  };

  const handleGenerateThumbnail = (activity: RecentActivityItem) => {
    const params = new URLSearchParams({
      ideaId: activity.id,
      title: activity.title,
      niche: activity.niche || 'general',
    });
    router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Recent Activity
      </h3>
      <div className="mt-4 space-y-4">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type];
          const iconColor = activityColors[activity.type];

          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-lg border border-gray-100 p-4 transition hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
            >
              <div
                className={cn(
                  "rounded-lg bg-gray-50 p-2 dark:bg-neutral-900",
                  "flex-shrink-0"
                )}
              >
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {activity.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className={statusColors[activity.status]}>
                        {activity.status}
                      </Badge>
                      {activity.viralityScore && (
                        <span className="text-sm text-muted-foreground">
                          Score: {activity.viralityScore}/100
                        </span>
                      )}
                      {activity.niche && (
                        <span className="text-sm text-muted-foreground">
                          • {activity.niche}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {/* Quick Actions */}
                {activity.type === 'idea' && activity.status === 'draft' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateScript(activity)}
                    >
                      <FileText className="mr-1 h-3 w-3" />
                      Script
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateTitle(activity)}
                    >
                      <TrendingUp className="mr-1 h-3 w-3" />
                      Title
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateThumbnail(activity)}
                    >
                      <ImageIcon className="mr-1 h-3 w-3" />
                      Thumbnail
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="mt-4 w-full"
        onClick={() => router.push("/dashboard/content-calendar")}
      >
        View all content
      </Button>
    </Card>
  );
}
