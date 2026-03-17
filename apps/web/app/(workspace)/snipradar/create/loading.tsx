import { Skeleton } from "@/components/ui/skeleton";

export default function SnipRadarCreateLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[520px] w-full" />
    </div>
  );
}
