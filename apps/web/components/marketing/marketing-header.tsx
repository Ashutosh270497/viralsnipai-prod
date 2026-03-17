"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#marketplace", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs", comingSoon: true },
  { href: "/changelog", label: "Changelog", comingSoon: true }
];

export function MarketingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setElevated(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border/60 bg-background/85 px-6 transition-shadow backdrop-blur ${
        elevated ? "shadow-lg" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6" />
          ViralSnipAI
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} onNavigate={() => setIsMenuOpen(false)} />
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button
            asChild
            onClick={() => trackEvent({ name: "cta_try_free", payload: { source: "header" } })}
          >
            <Link href="/signup">Try Free</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            onClick={() => setIsMenuOpen((state) => !state)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Toggle navigation</span>
          </Button>
        </div>
      </div>
      <div
        id="mobile-nav"
        className={`${
          isMenuOpen ? "max-h-[360px] border-t border-border/60" : "max-h-0"
        } overflow-hidden transition-[max-height] duration-300 md:hidden`}
      >
        <div className="space-y-4 px-6 py-4">
          <nav className="space-y-3" aria-label="Mobile Primary">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} {...link} onNavigate={() => setIsMenuOpen(false)} className="block text-base font-medium text-foreground" />
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <Button variant="ghost" asChild className="justify-start">
              <Link href="/signin" onClick={() => setIsMenuOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              onClick={() => trackEvent({ name: "cta_try_free", payload: { source: "header_mobile" } })}
            >
              <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                Try Free
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

type NavLinkProps = {
  href: string;
  label: string;
  comingSoon?: boolean;
  className?: string;
  onNavigate?: () => void;
};

function NavLink({ href, label, comingSoon, className, onNavigate }: NavLinkProps) {
  if (comingSoon) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-muted-foreground/70", className)}>
        {label}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coming soon
        </span>
      </span>
    );
  }

  const isAnchor = href.startsWith("#");
  if (isAnchor) {
    return (
      <a
        href={href}
        className={cn("transition hover:text-foreground", className)}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cn("transition hover:text-foreground", className)} onClick={onNavigate}>
      {label}
    </Link>
  );
}
