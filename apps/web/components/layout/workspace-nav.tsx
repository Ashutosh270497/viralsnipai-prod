"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Scissors,
  Palette,
  FolderKanban,
  FileText,
  Image as ImageIcon,
  Film,
  Mic,
  Wand2
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

export function WorkspaceNav() {
  const pathname = usePathname();
  const flags = useFeatureFlags();

  const links: WorkspaceLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/hooksmith", label: "Hooksmith", icon: Sparkles },
    { href: "/repurpose", label: "RepurposeOS", icon: Scissors },
    { href: "/agent-editor", label: "Agent Editor", icon: Wand2 },
    { href: "/brand-kit", label: "Brand Kit", icon: Palette },
    { href: "/projects", label: "Projects", icon: FolderKanban }
  ];

  if (flags.transcribeUiEnabled) {
    links.splice(3, 0, { href: "/transcribe", label: "Transcribe", icon: FileText });
  }
  if (flags.imagenEnabled) {
    links.splice(3, 0, { href: "/imagen", label: "Imagen", icon: ImageIcon });
  }
  const videoLinksIndex = 4;
  if (flags.soraEnabled) {
    links.splice(videoLinksIndex, 0, { href: "/video", label: "Video Lab", icon: Film });
  }
  if (flags.voicerEnabled) {
    links.splice(videoLinksIndex + (flags.soraEnabled ? 1 : 0), 0, {
      href: "/voicer",
      label: "Voicer",
      icon: Mic
    });
  }
  if (flags.veoEnabled) {
    links.splice(videoLinksIndex + (flags.soraEnabled ? 1 : 0) + (flags.voicerEnabled ? 1 : 0), 0, {
      href: "/veo",
      label: "Veo",
      icon: Film
    });
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-disabled={link.disabled ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-secondary",
              isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
              link.disabled && !isActive ? "opacity-70" : undefined
            )}
            title={link.disabled ? "Temporarily unavailable" : undefined}
          >
            <Icon className="h-4 w-4" />
            {link.label}
            {link.disabled ? (
              <span className="ml-auto text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paused
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
