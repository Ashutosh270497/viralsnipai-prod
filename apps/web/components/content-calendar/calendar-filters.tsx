"use client";

import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarFilters as CalendarFiltersType } from "@/lib/types/content-calendar";

interface CalendarFiltersProps {
  filters: CalendarFiltersType;
  onFiltersChange: (filters: CalendarFiltersType) => void;
  resultCount: number;
}

export function CalendarFilters({ filters, onFiltersChange, resultCount }: CalendarFiltersProps) {
  const hasActiveFilters =
    filters.videoType ||
    filters.contentCategory ||
    filters.status ||
    (filters.minViralityScore && filters.minViralityScore > 0);

  const clearFilters = () => {
    onFiltersChange({});
  };

  const updateFilter = (key: keyof CalendarFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? undefined : value,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {/* Video Type Filter */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Video Type</label>
          <Select
            value={filters.videoType || "all"}
            onValueChange={(value) => updateFilter("videoType", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="short">🎬 Shorts</SelectItem>
              <SelectItem value="long-form">📺 Long-form</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Category Filter */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Category</label>
          <Select
            value={filters.contentCategory || "all"}
            onValueChange={(value) => updateFilter("contentCategory", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="trending">🔥 Trending</SelectItem>
              <SelectItem value="evergreen">📝 Evergreen</SelectItem>
              <SelectItem value="experimental">⚡ Experimental</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) => updateFilter("status", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="idea">💡 Idea</SelectItem>
              <SelectItem value="scripted">📝 Scripted</SelectItem>
              <SelectItem value="published">✅ Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Virality Score Filter */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Min Virality</label>
          <Select
            value={String(filters.minViralityScore || 0)}
            onValueChange={(value) => updateFilter("minViralityScore", Number(value))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any Score</SelectItem>
              <SelectItem value="50">50+ (Medium)</SelectItem>
              <SelectItem value="70">70+ (Good)</SelectItem>
              <SelectItem value="80">80+ (High)</SelectItem>
              <SelectItem value="90">90+ (Excellent)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-2 text-center">
        <span className="text-lg font-bold">{resultCount}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">
          {resultCount === 1 ? "result" : "results"}
        </span>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1">
          {filters.videoType && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              {filters.videoType === "short" ? "🎬 Shorts" : "📺 Long-form"}
            </Badge>
          )}
          {filters.contentCategory && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 capitalize">
              {filters.contentCategory === "trending" && "🔥"}
              {filters.contentCategory === "evergreen" && "📝"}
              {filters.contentCategory === "experimental" && "⚡"}
              {" "}
              {filters.contentCategory}
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 capitalize">
              {filters.status}
            </Badge>
          )}
          {filters.minViralityScore && filters.minViralityScore > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              Score {filters.minViralityScore}+
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
