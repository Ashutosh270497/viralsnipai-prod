"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/marketing/logo";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import type { Ecosystem } from "@/lib/ecosystem";
import { getEcosystemHome } from "@/lib/ecosystem";

interface MobileSidebarProps {
  user: {
    name?: string;
    email: string;
    image?: string;
  };
  ecosystem: Ecosystem;
}

export function MobileSidebar({ user, ecosystem }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const homeHref = getEcosystemHome(ecosystem);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="left-0 right-auto w-64 translate-x-0 p-0 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-5">
            <Link
              href={homeHref}
              className="flex items-center gap-2.5"
              onClick={() => setOpen(false)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
                <Logo className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold tracking-tight">
                ViralSnip<span className="text-primary">AI</span>
              </span>
            </Link>
          </div>
          <WorkspaceNav user={user} ecosystem={ecosystem} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
