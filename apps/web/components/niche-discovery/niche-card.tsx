"use client";

import { ExternalLink, Clock, Users, DollarSign, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CompetitionGauge } from "./competition-gauge";
import { MonetizationStars } from "./monetization-stars";
import { TrendingBadge } from "./trending-badge";
import type { NicheRecommendation } from "@/lib/types/niche";
import type { NicheData } from "@/lib/types/niche";

interface NicheCardProps {
  niche: NicheRecommendation | NicheData;
  matchScore?: number;
  reasoning?: string;
  onSelect?: (niche: NicheRecommendation | NicheData) => void;
  onViewDetails?: (niche: NicheRecommendation | NicheData) => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function NicheCard({
  niche,
  matchScore,
  reasoning,
  onSelect,
  onViewDetails,
  isSelected = false,
  compact = false,
}: NicheCardProps) {
  const displayMatchScore = matchScore ?? (niche as NicheRecommendation).matchScore;
  const displayReasoning = reasoning ?? (niche as NicheRecommendation).reasoning;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:shadow-lg",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        compact ? "p-4" : ""
      )}
    >
      {displayMatchScore && (
        <div className="absolute right-3 top-3 z-10">
          <div
            className={cn(
              "rounded-full px-2.5 py-1 text-sm font-bold",
              displayMatchScore >= 90
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                : displayMatchScore >= 70
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                : "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
            )}
          >
            {displayMatchScore}% Match
          </div>
        </div>
      )}

      <CardHeader className={cn(compact ? "pb-2" : "")}>
        <div className="flex items-start justify-between">
          <div className="space-y-1 pr-16">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {niche.name}
            </h3>
            <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
              {niche.category}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-4", compact ? "pb-2" : "")}>
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-neutral-400">
          {niche.description}
        </p>

        {displayReasoning && !compact && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {displayReasoning}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
              Competition
            </span>
            <CompetitionGauge level={niche.competitionLevel} size="sm" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
              Growth
            </span>
            <TrendingBadge trend={niche.growthTrend} size="sm" />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
            Monetization Potential
          </span>
          <MonetizationStars score={niche.monetizationPotential} size="sm" />
        </div>

        {!compact && (
          <>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                <span>${niche.averageCPM.toFixed(2)} CPM</span>
              </div>
              {(niche as NicheData).minHoursPerWeek && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{(niche as NicheData).minHoursPerWeek}+ hrs/week</span>
                </div>
              )}
            </div>

            {niche.contentTypes && niche.contentTypes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
                  Content Types
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {niche.contentTypes.slice(0, 4).map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                      <Video className="h-3 w-3" />
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {niche.exampleChannels && niche.exampleChannels.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
                  Example Channels
                </span>
                <div className="space-y-1">
                  {niche.exampleChannels.slice(0, 3).map((channel, index) => (
                    <a
                      key={index}
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-md p-1.5 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
                    >
                      <span className="font-medium text-gray-700 dark:text-neutral-300">
                        {channel.name}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-neutral-500">
                        <Users className="h-3 w-3" />
                        {channel.subscribers}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className={cn("flex gap-2", compact ? "pt-2" : "")}>
        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(niche)}
            className="flex-1"
          >
            View Details
          </Button>
        )}
        {onSelect && (
          <Button
            size="sm"
            onClick={() => onSelect(niche)}
            className={cn(
              "flex-1",
              isSelected
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isSelected ? "Selected" : "Select This Niche"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
