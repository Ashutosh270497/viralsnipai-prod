export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { generateImagenPrompt } from "@/lib/openai";

const schema = z
  .object({
    context: z.string().max(800).optional(),
    existingPrompt: z.string().max(800).optional(),
    aspectRatio: z.string().max(16).optional(),
    styleHint: z.string().max(160).optional(),
    negativePrompt: z.string().max(400).optional()
  })
  .refine(
    (value) => {
      const hasContext = typeof value.context === "string" && value.context.trim().length > 0;
      const hasExisting = typeof value.existingPrompt === "string" && value.existingPrompt.trim().length > 0;
      return hasContext || hasExisting;
    },
    { message: "Provide some context or an existing prompt.", path: ["context"] }
  );

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten(), message: "Invalid payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await generateImagenPrompt({
      context: parsed.data.context?.trim() || parsed.data.existingPrompt?.trim() || "",
      existingPrompt: parsed.data.existingPrompt,
      aspectRatio: parsed.data.aspectRatio,
      styleHint: parsed.data.styleHint,
      negativePrompt: parsed.data.negativePrompt
    });

    return NextResponse.json(
      {
        prompt: result.prompt,
        negativePrompt: result.negativePrompt ?? null
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Imagen] Prompt generation failed", error);
    const message = error instanceof Error ? error.message : "Unable to craft a prompt right now.";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
