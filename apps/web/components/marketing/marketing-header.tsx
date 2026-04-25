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
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" }
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
      className={`sticky top-0 z-40 border-b px-6 transition-all backdrop-blur-xl ${
        elevated
          ? "border-slate-200/80 bg-white/[0.82] shadow-lg shadow-slate-950/5 dark:border-white/10 dark:bg-[#081111]/[0.82]"
          : "border-slate-200/60 bg-white/[0.68] dark:border-white/10 dark:bg-[#081111]/[0.68]"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6" />
          ViralSnipAI
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} onNavigate={() => setIsMenuOpen(false)} />
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild className="rounded-full">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 font-semibold text-white shadow-lg shadow-emerald-900/15 hover:from-emerald-400 hover:to-cyan-400"
            onClick={() => trackEvent({ name: "cta_try_free", payload: { source: "header" } })}
          >
            <Link href="/signup">Start free</Link>
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
            <Button variant="ghost" asChild className="justify-start rounded-full">
              <Link href="/signin" onClick={() => setIsMenuOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
              onClick={() => trackEvent({ name: "cta_try_free", payload: { source: "header_mobile" } })}
            >
              <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                Start free
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
        className={cn("transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:text-white", className)}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cn("transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:text-white", className)} onClick={onNavigate}>
      {label}
    </Link>
  );
}
