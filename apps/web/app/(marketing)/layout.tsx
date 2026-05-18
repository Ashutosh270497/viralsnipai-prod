import Link from "next/link";
import { ReactNode } from "react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { getSupportEmail, getSupportMailto } from "@/lib/support";

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
    <footer className="border-t border-white/10 bg-[#05070d] px-6 py-12 text-xs text-slate-400">
      <div className="mx-auto grid w-full max-w-7xl gap-8 text-left sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <h3 className="text-base font-semibold text-white">ViralSnipAI</h3>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            Premium AI creator workflow for turning long videos into precise, viral-ready short clips.
          </p>
        </div>
        <FooterColumn title="Product" links={[{ href: "/#features", label: "Features" }, { href: "/#how-it-works", label: "How it works" }, { href: "/pricing", label: "Pricing" }]} />
        <FooterColumn title="Workflow" links={[{ href: "/#pricing", label: "Free, Plus, Pro" }, { href: "/#faq", label: "FAQ" }, { href: "/signup", label: "Start free" }]} />
        <FooterColumn title="Legal" links={[{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: getSupportMailto("ViralSnipAI support"), label: getSupportEmail(), external: true }]} />
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 pt-10 text-slate-500 sm:flex-row sm:items-center">
        <p>ViralSnipAI © {new Date().getFullYear()} - Long videos into viral-ready clips with AI precision.</p>
        <div className="flex items-center gap-3 text-sm">
          <a href="https://twitter.com" aria-label="X" className="hover:text-white" rel="noreferrer">
            X
          </a>
          <a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-white" rel="noreferrer">
            LinkedIn
          </a>
          <a href="https://www.youtube.com" aria-label="YouTube" className="hover:text-white" rel="noreferrer">
            YouTube
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string; external?: boolean }> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      <ul className="space-y-2 text-xs">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a href={link.href} className="break-all transition hover:text-white">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
