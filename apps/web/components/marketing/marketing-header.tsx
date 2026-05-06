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
  { href: "#how-it-works", label: "Workflow" },
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
      className={`sticky top-0 z-40 px-4 py-3 text-white transition-all ${
        elevated
          ? "bg-[#030611]/70"
          : "bg-transparent"
      }`}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-full border border-white/10 bg-[#05070d]/78 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl transition-all sm:px-5",
          elevated && "border-cyan-300/15 bg-[#05070d]/88 shadow-cyan-950/15"
        )}
      >
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6 text-cyan-300" />
          ViralSnipAI
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} onNavigate={() => setIsMenuOpen(false)} />
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild className="rounded-full text-slate-200 hover:bg-white/10 hover:text-white">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
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
        className={cn(
          "mx-auto mt-3 max-w-7xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#05070d]/92 shadow-2xl shadow-black/25 backdrop-blur-xl transition-[max-height,opacity] duration-300 md:hidden",
          isMenuOpen ? "max-h-[360px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-4 px-5 py-5">
          <nav className="space-y-3" aria-label="Mobile Primary">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} {...link} onNavigate={() => setIsMenuOpen(false)} className="block text-base font-medium text-white" />
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <Button variant="ghost" asChild className="justify-start rounded-full text-slate-200 hover:bg-white/10 hover:text-white">
              <Link href="/signin" onClick={() => setIsMenuOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 text-white"
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
        className={cn("transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300", className)}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cn("transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300", className)} onClick={onNavigate}>
      {label}
    </Link>
  );
}
