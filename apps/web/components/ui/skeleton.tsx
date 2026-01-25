/**
 * Skeleton Components
 *
 * Loading placeholder components with pulse animation.
 * Specialized variants for different UI elements.
 *
 * @module Skeleton
 */

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

/**
 * Clip card skeleton for loading states
 */
function ClipCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

/**
 * Search result skeleton
 */
function SearchResultSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border border-l-4 border-l-primary p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Chapter card skeleton
 */
function ChapterCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

/**
 * Timeline skeleton
 */
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <ChapterCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export {
  Skeleton,
  ClipCardSkeleton,
  SearchResultSkeleton,
  ChapterCardSkeleton,
  TimelineSkeleton
};
