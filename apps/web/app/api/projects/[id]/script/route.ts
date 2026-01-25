import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const scriptSchema = z.object({
  hooks: z.array(z.string()).optional(),
  body: z.string().min(10),
  tone: z.string().optional()
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json();
  const result = scriptSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: { script: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if (project.script) {
    const script = await prisma.script.update({
      where: { id: project.script.id },
      data: {
        body: result.data.body,
        tone: result.data.tone,
        ...(result.data.hooks ? { hooks: result.data.hooks } : {})
      }
    });

    return NextResponse.json({ script }, { headers: { "Cache-Control": "no-store" } });
  }

  const script = await prisma.script.create({
    data: {
      body: result.data.body,
      tone: result.data.tone,
      hooks: result.data.hooks ?? [],
      project: {
        connect: { id: project.id }
      }
    }
  });

  return NextResponse.json({ script }, { headers: { "Cache-Control": "no-store" } });
}
