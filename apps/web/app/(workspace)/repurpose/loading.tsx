import { Skeleton } from "@/components/ui/skeleton";

export default function RepurposeLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[360px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

