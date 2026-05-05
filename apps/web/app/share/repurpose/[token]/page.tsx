import { notFound } from "next/navigation";
import { Clock, Eye, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { ShareApproveButton } from "@/components/repurpose/share-approve-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RepurposeSharePage({ params }: { params: { token: string } }) {
  const link = await (prisma as any).shareLink.findUnique({
    where: { token: params.token },
    include: {
      project: { select: { title: true, topic: true } },
      clip: {
        select: {
          id: true,
          title: true,
          summary: true,
          callToAction: true,
          previewPath: true,
          thumbnail: true,
          captionSrt: true,
          reviewStatus: true,
          viralityScore: true,
          startMs: true,
          endMs: true,
        },
      },
    },
  });

  if (!link) notFound();

  const expired = link.expiresAt && link.expiresAt.getTime() < Date.now();
  const clip = link.clip;

  return (
    <main className="min-h-screen bg-[#07080d] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                ViralSnipAI Review Link
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                {clip?.title || link.project.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                {clip?.summary || link.project.topic || "Review this clip package before publishing."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge icon={Eye} label={link.permission} />
              <Badge icon={ShieldCheck} label={expired ? "expired" : "token protected"} />
              {link.expiresAt ? <Badge icon={Clock} label={`expires ${link.expiresAt.toLocaleDateString()}`} /> : null}
            </div>
          </div>
        </header>

        {expired ? (
          <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
            <h2 className="text-lg font-semibold text-red-200">This review link has expired.</h2>
            <p className="mt-2 text-sm text-red-100/65">Ask the project owner to create a new share link.</p>
          </section>
        ) : clip ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black">
                {clip.previewPath ? (
                  <video src={clip.previewPath} controls playsInline poster={clip.thumbnail ?? undefined} className="aspect-[9/16] w-full object-contain" />
                ) : clip.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.thumbnail} alt="" className="aspect-[9/16] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center text-sm text-white/35">
                    Preview unavailable
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Clip details</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Duration" value={`${Math.round((clip.endMs - clip.startMs) / 1000)}s`} />
                  <Row label="Virality" value={clip.viralityScore ? `${clip.viralityScore}/100` : "Not scored"} />
                  <Row label="Status" value={clip.reviewStatus} />
                  <Row label="CTA" value={clip.callToAction || "None"} />
                </dl>
              </div>

              {link.permission === "approve" ? (
                <ShareApproveButton token={params.token} />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/55">
                  This link is read-only. Ask for an approval link if you need to approve clips.
                </div>
              )}
            </aside>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <h2 className="text-lg font-semibold">{link.project.title}</h2>
            <p className="mt-2 text-sm text-white/55">Project-level sharing is enabled. Clip-level approval requires a clip-specific link.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function Badge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold capitalize text-white/70">
      <Icon className="h-3.5 w-3.5" />
      {label.replace("_", " ")}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-right font-medium text-white/80">{value}</dd>
    </div>
  );
}
