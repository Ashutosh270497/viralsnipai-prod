export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { generateHooks } from "@/lib/openai";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    topic: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
        z.string().min(3).optional()
      )
      .optional(),
    sourceUrl: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
        z.string().url().optional()
      )
      .optional(),
    audience: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string().min(1).optional()
      )
      .optional(),
    tone: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string().min(1).optional()
      )
      .optional(),
    projectId: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
        z.string().optional()
      )
      .optional()
  })
  .refine((data) => data.topic || data.sourceUrl, {
    message: "Provide a topic or source URL",
    path: ["topic"]
  });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.hookGenerate);
  const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.hookGenerate);

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

  const hooks = await generateHooks({
    topic: result.data.topic ?? result.data.sourceUrl ?? "your topic",
    sourceUrl: result.data.sourceUrl,
    audience: result.data.audience,
    tone: result.data.tone
  });

  if (result.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: result.data.projectId, userId: user.id },
      include: { script: true }
    });

    if (project) {
      if (project.script) {
        await prisma.script.update({
          where: { id: project.script.id },
          data: { hooks }
        });
      } else {
        await prisma.script.create({
          data: {
            hooks,
            body: "",
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
    }
  }

  return NextResponse.json({ hooks }, { headers: { "Cache-Control": "no-store" } });
}
