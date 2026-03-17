import { Skeleton } from "@/components/ui/skeleton";

export default function SnipRadarDiscoverLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
