"use client";

import { ExternalLink, Users, DollarSign, Clock, Target, Video, TrendingUp, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CompetitionGauge } from "./competition-gauge";
import { MonetizationStars } from "./monetization-stars";
import { TrendingBadge } from "./trending-badge";
import type { NicheRecommendation, NicheData } from "@/lib/types/niche";

interface NicheDetailsModalProps {
  niche: NicheRecommendation | NicheData | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (niche: NicheRecommendation | NicheData) => void;
  isSelecting?: boolean;
}

export function NicheDetailsModal({
  niche,
  isOpen,
  onClose,
  onSelect,
  isSelecting = false,
}: NicheDetailsModalProps) {
  if (!niche) return null;

  const matchScore = (niche as NicheRecommendation).matchScore;
  const reasoning = (niche as NicheRecommendation).reasoning;
  const trendingTopics = (niche as NicheRecommendation).trendingTopics || (niche as NicheData).keywords;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{niche.name}</DialogTitle>
              <DialogDescription className="mt-1">
                <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {niche.category}
                </span>
              </DialogDescription>
            </div>
            {matchScore && (
              <div className="rounded-full bg-blue-100 px-3 py-1.5 text-lg font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                {matchScore}% Match
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Description */}
          <p className="text-gray-600 dark:text-neutral-400">{niche.description}</p>

          {/* AI Reasoning */}
          {reasoning && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <h4 className="mb-2 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300">
                <Target className="h-4 w-4" />
                Why This Niche Fits You
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">{reasoning}</p>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-neutral-700">
              <h4 className="mb-3 text-sm font-semibold text-gray-500 dark:text-neutral-500">
                Competition Analysis
              </h4>
              <CompetitionGauge level={niche.competitionLevel} size="lg" />
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-neutral-700">
              <h4 className="mb-3 text-sm font-semibold text-gray-500 dark:text-neutral-500">
                Monetization Potential
              </h4>
              <MonetizationStars score={niche.monetizationPotential} size="lg" />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-neutral-800">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${niche.averageCPM.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">
                Average CPM
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-neutral-800">
              <TrendingUp className="mx-auto mb-2 h-6 w-6 text-blue-600" />
              <TrendingBadge trend={niche.growthTrend} size="md" />
              <div className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                Growth Trend
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-neutral-800">
              <Clock className="mx-auto mb-2 h-6 w-6 text-purple-600" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {(niche as NicheData).minHoursPerWeek || "8+"}
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">
                Hours/Week
              </div>
            </div>
          </div>

          {/* Target Audience */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-neutral-700">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-neutral-300">
              <Users className="h-4 w-4" />
              Target Audience
            </h4>
            <p className="text-gray-600 dark:text-neutral-400">{niche.targetAudience}</p>
          </div>

          {/* Content Types */}
          {niche.contentTypes && niche.contentTypes.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-neutral-300">
                <Video className="h-4 w-4" />
                Content Types That Work
              </h4>
              <div className="flex flex-wrap gap-2">
                {niche.contentTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trending Topics */}
          {trendingTopics && trendingTopics.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-neutral-300">
                <Hash className="h-4 w-4" />
                Trending Topics / Keywords
              </h4>
              <div className="flex flex-wrap gap-2">
                {trendingTopics.slice(0, 8).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    #{topic.replace(/\s+/g, "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Example Channels */}
          {niche.exampleChannels && niche.exampleChannels.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-neutral-300">
                Successful Channels in This Niche
              </h4>
              <div className="space-y-2">
                {niche.exampleChannels.map((channel, index) => (
                  <a
                    key={index}
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        {channel.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {channel.name}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400">
                          <Users className="h-3 w-3" />
                          {channel.subscribers} subscribers
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => onSelect(niche)}
            disabled={isSelecting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSelecting ? "Selecting..." : "Select This Niche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
