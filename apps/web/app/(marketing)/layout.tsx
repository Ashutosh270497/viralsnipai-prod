import Link from "next/link";
import { ReactNode } from "react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { CookieBanner } from "@/components/marketing/cookie-banner";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/90 px-6 py-10 text-xs text-slate-600 dark:border-white/10 dark:bg-[#081111] dark:text-slate-400">
      <div className="mx-auto grid w-full max-w-6xl gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title="Product" links={[{ href: "#features", label: "Features" }, { href: "#how-it-works", label: "How it works" }, { href: "/pricing", label: "Pricing" }]} />
        <FooterColumn title="Launch" links={[{ href: "#pricing", label: "Free, Plus, Pro" }, { href: "#faq", label: "FAQ" }, { href: "/signup", label: "Start free" }]} />
        <FooterColumn title="Use cases" links={[{ href: "/", label: "Podcasts" }, { href: "/", label: "Webinars" }, { href: "/", label: "Founder videos" }]} />
        <FooterColumn title="Legal" links={[{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/data-deletion", label: "Data deletion" }]} />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 pt-8 text-slate-500 sm:flex-row sm:items-center dark:text-slate-500">
        <p>ViralSnipAI © {new Date().getFullYear()} • Long videos into viral-ready clips with AI hooks, captions, and branded exports.</p>
        <div className="flex items-center gap-3 text-sm">
          <a href="https://twitter.com" aria-label="X" className="hover:text-slate-950 dark:hover:text-white" rel="noreferrer">
            X
          </a>
          <a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-slate-950 dark:hover:text-white" rel="noreferrer">
            LinkedIn
          </a>
          <a href="https://www.youtube.com" aria-label="YouTube" className="hover:text-slate-950 dark:hover:text-white" rel="noreferrer">
            YouTube
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <ul className="space-y-2 text-xs">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="transition hover:text-slate-950 dark:hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
