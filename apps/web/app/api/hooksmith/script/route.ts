export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { generateScript } from "@/lib/openai";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  hook: z.string().min(5),
  audience: z.string().optional(),
  tone: z.string().optional(),
  durationSec: z.number().optional(),
  projectId: z.string()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.scriptGenerate);
  const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.scriptGenerate);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before generating more.", retryAfterSec: rateLimitResult.retryAfterSec },
      { status: 429, headers: rlHeaders }
    );
  }

  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
    include: { script: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const scriptBody = await generateScript({
    hook: result.data.hook,
    audience: result.data.audience,
    tone: result.data.tone,
    durationSec: result.data.durationSec
  });

  const existingHooks = Array.isArray(project.script?.hooks)
    ? (project.script?.hooks as string[])
    : [];

  let script;
  if (project.script) {
    script = await prisma.script.update({
      where: { id: project.script.id },
      data: {
        body: scriptBody,
        tone: result.data.tone,
        hooks: existingHooks.length ? existingHooks : [result.data.hook]
      }
    });
  } else {
    script = await prisma.script.create({
      data: {
        body: scriptBody,
        tone: result.data.tone,
        hooks: [result.data.hook],
        project: {
          connect: { id: project.id }
        }
      }
    });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { updatedAt: new Date() }
  });

  return NextResponse.json({ script }, { headers: { "Cache-Control": "no-store" } });
}
