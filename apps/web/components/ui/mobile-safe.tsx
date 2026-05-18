import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function KeyboardSafeFormShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] dark:bg-black sm:py-12",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function MobileStickyCTA({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 border-t border-border/60 bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

