"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/snipradar/overview", label: "Overview" },
  { href: "/snipradar/discover", label: "Discover" },
  { href: "/snipradar/inbox", label: "Inbox" },
  { href: "/snipradar/relationships", label: "Relationships" },
  { href: "/snipradar/create", label: "Create" },
  { href: "/snipradar/publish", label: "Publish" },
  { href: "/snipradar/analytics", label: "Analytics" },
  { href: "/snipradar/growth-planner", label: "Growth Plan" },
];

export function SnipRadarSubNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/snipradar/overview") {
      return pathname === "/snipradar" || pathname?.startsWith("/snipradar/overview");
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex gap-2 overflow-x-auto px-1 py-2">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-md border px-3 text-sm transition",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
