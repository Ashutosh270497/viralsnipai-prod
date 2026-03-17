import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ViralSnipAI",
  description: "Terms governing the use of ViralSnipAI, connected platforms, generated content, and Razorpay billing.",
};

const sections = [
  {
    title: "Use of the service",
    body:
      "You may use ViralSnipAI only in compliance with applicable law, the policies of connected platforms, and these terms. You remain responsible for content you upload, generate, publish, or schedule through the product."
  },
  {
    title: "Connected accounts",
    body:
      "If you connect third-party platforms such as YouTube, X, Google services, or payment providers, you authorize ViralSnipAI to access only the scopes required for the enabled features. If those connections are revoked, expired, or invalidated, some workflows will stop working until you reconnect them."
  },
  {
    title: "Subscriptions and billing",
    body:
      "Paid plans are billed through Razorpay. Subscription renewals, cancellations, taxes, supported billing cycles, and retained billing records are governed by the active plan selected at checkout, the payment terms shown before authorization, and the operational need to reconcile subscription events."
  },
  {
    title: "Generated content",
    body:
      "AI-generated outputs are provided as assistive tools. You are responsible for reviewing generated scripts, posts, media, and automations before publishing or using them commercially."
  },
  {
    title: "Suspension, termination, and account removal",
    body:
      "We may suspend or terminate access for abuse, fraud, platform-policy violations, payment failure, or security risk. You may stop using the service at any time and cancel recurring billing at the end of the active paid period. Account-removal requests may involve asynchronous cleanup of stored assets and generated artifacts, while some billing, fraud-prevention, or reconciliation records may remain where legitimately required."
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Terms</p>
          <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            These terms govern access to ViralSnipAI, including creator workflows, connected providers, and paid plans.
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
          Questions about terms, billing, or platform usage can be raised through support. Return to the{" "}
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
