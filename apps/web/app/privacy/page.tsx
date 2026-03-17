import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ViralSnipAI",
  description: "Privacy policy covering account data, connected providers, storage, and subscription billing for ViralSnipAI.",
};

const sections = [
  {
    title: "Data categories",
    body:
      "We store account identity data, onboarding preferences, connected-provider tokens where required for enabled features, uploaded media, generated outputs such as scripts or drafts, transcripts and translations, billing identifiers, and limited usage or diagnostic logs needed to operate the product."
  },
  {
    title: "How data is used",
    body:
      "We use your data to authenticate you, deliver product features, sync connected platforms, process subscriptions, improve reliability, and prevent abuse. We do not sell personal data."
  },
  {
    title: "Third-party processors",
    body:
      "ViralSnipAI uses infrastructure and AI partners such as Supabase, Vercel, OpenRouter or routed model providers, OpenAI where some direct APIs still apply, Google APIs, X, Razorpay, and storage providers where required to deliver the service."
  },
  {
    title: "Retention baseline",
    body:
      "Project data, generated assets, and connected-provider metadata are retained while your account is active unless you delete them earlier. Billing records and webhook reconciliation logs may be retained for finance, fraud, tax, and compliance purposes even after cancellation. Temporary processing files are cleaned up on a best-effort basis after jobs complete or fail."
  },
  {
    title: "Deletion and connected-account controls",
    body:
      "You can request account deletion, provider disconnects, and support assistance for data removal. Google, X, and other provider connections are user-initiated and should only be used for the workflows you enable. If a provider token is revoked or expires permanently, re-authentication is required. Account cleanup may involve asynchronous removal of stored assets and derived processing artifacts."
  },
  {
    title: "Operational boundary",
    body:
      "This privacy page reflects the product’s current operational baseline. It should not be read as a claim of full GDPR, CCPA, or enterprise compliance certification."
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Privacy</p>
          <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This policy explains how ViralSnipAI handles account, creator, connected-platform, and billing data.
          </p>
          <p className="text-xs text-muted-foreground">Last updated: March 8, 2026</p>
        </div>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-secondary/20 p-6 text-sm text-muted-foreground">
          Questions about privacy or deletion requests can be sent through support. Return to the{" "}
          <Link href="/signin" className="font-medium text-primary underline underline-offset-4">
            sign-in page
          </Link>{" "}
          or the{" "}
          <Link href="/" className="font-medium text-primary underline underline-offset-4">
            homepage
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
