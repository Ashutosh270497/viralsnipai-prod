"use client";

import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NICHE_CATEGORIES } from "@/lib/types/niche";
import type { NicheCategory, CompetitionLevel, GrowthTrend } from "@/lib/types/niche";

interface NicheFilters {
  category?: NicheCategory;
  competition?: CompetitionLevel;
  monetizationMin?: number;
  growthTrend?: GrowthTrend;
  faceless?: boolean;
  search?: string;
}

interface NicheFilterBarProps {
  filters: NicheFilters;
  onFiltersChange: (filters: NicheFilters) => void;
  onClearFilters: () => void;
}

export function NicheFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
}: NicheFilterBarProps) {
  const hasActiveFilters =
    filters.category ||
    filters.competition ||
    filters.monetizationMin ||
    filters.growthTrend ||
    filters.faceless ||
    filters.search;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search niches..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category */}
        <Select
          value={filters.category || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              category: value === "all" ? undefined : (value as NicheCategory),
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {NICHE_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Competition */}
        <Select
          value={filters.competition || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              competition:
                value === "all" ? undefined : (value as CompetitionLevel),
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Competition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="low">Low Competition</SelectItem>
            <SelectItem value="medium">Medium Competition</SelectItem>
            <SelectItem value="high">High Competition</SelectItem>
          </SelectContent>
        </Select>

        {/* Monetization */}
        <Select
          value={filters.monetizationMin?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              monetizationMin:
                value === "all" ? undefined : parseInt(value, 10),
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Monetization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Monetization</SelectItem>
            <SelectItem value="6">6+ Monetization</SelectItem>
            <SelectItem value="7">7+ Monetization</SelectItem>
            <SelectItem value="8">8+ High Monetization</SelectItem>
            <SelectItem value="9">9+ Top Monetization</SelectItem>
          </SelectContent>
        </Select>

        {/* Growth Trend */}
        <Select
          value={filters.growthTrend || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              growthTrend: value === "all" ? undefined : (value as GrowthTrend),
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Growth" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trends</SelectItem>
            <SelectItem value="rising">Rising</SelectItem>
            <SelectItem value="stable">Stable</SelectItem>
            <SelectItem value="declining">Declining</SelectItem>
          </SelectContent>
        </Select>

        {/* Faceless Toggle */}
        <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-neutral-700">
          <Switch
            id="faceless"
            checked={filters.faceless || false}
            onCheckedChange={(checked) =>
              onFiltersChange({
                ...filters,
                faceless: checked || undefined,
              })
            }
          />
          <Label
            htmlFor="faceless"
            className="cursor-pointer text-sm font-medium"
          >
            Faceless Only
          </Label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <X className="mr-1 h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filters Count */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400">
          <Filter className="h-4 w-4" />
          <span>
            {Object.values(filters).filter(Boolean).length} filter(s) active
          </span>
        </div>
      )}
    </div>
  );
}
