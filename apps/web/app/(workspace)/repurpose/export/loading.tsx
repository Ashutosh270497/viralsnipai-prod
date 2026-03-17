import { Skeleton } from "@/components/ui/skeleton";

export default function RepurposeExportLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[280px]" />
      <Skeleton className="h-[320px]" />
    </div>
  );
}

