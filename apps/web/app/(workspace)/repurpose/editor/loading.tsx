import { Skeleton } from "@/components/ui/skeleton";

export default function RepurposeEditorLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>
    </div>
  );
}

