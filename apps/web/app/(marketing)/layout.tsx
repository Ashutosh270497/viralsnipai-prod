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
    <footer className="border-t border-border/60 bg-background/90 px-6 py-10 text-xs text-muted-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title="Product" links={[{ href: "#features", label: "Features" }, { href: "#marketplace", label: "Templates" }, { href: "/pricing", label: "Pricing" }]} />
        <FooterColumn title="Company" links={[{ href: "/about", label: "About" }, { href: "/careers", label: "Careers" }, { href: "/changelog", label: "Changelog" }]} />
        <FooterColumn title="Resources" links={[{ href: "/docs", label: "Docs" }, { href: "/templates", label: "Template library" }, { href: "/blog", label: "Blog" }]} />
        <FooterColumn title="Legal" links={[{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/data-deletion", label: "Data deletion" }]} />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 pt-8 text-muted-foreground sm:flex-row sm:items-center">
        <p>ViralSnipAI © {new Date().getFullYear()} • Built for video-first teams. ViralSnipAI complies with platform API policies. No scraping.</p>
        <div className="flex items-center gap-3 text-sm">
          <a href="https://twitter.com" aria-label="X" className="hover:text-foreground" rel="noreferrer">
            X
          </a>
          <a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-foreground" rel="noreferrer">
            LinkedIn
          </a>
          <a href="https://www.youtube.com" aria-label="YouTube" className="hover:text-foreground" rel="noreferrer">
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
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2 text-xs">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="transition hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
