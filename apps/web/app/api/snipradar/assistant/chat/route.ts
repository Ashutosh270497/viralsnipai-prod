/**
 * POST /api/snipradar/assistant/chat
 *
 * Streaming chat endpoint for the SnipRadar Assistant.
 * - Authenticates the user via NextAuth session
 * - Rate-limits: 5 messages / min (burst) + 20 messages / hour (hourly)
 * - Loads the last N messages from the session as history
 * - Runs RAG retrieval, then streams LLM tokens as NDJSON events
 * - Persists user + assistant messages once the stream ends
 *
 * Stream protocol (newline-delimited JSON):
 *   {"type":"token","content":"..."}   — each LLM token chunk
 *   {"type":"done","sessionId":"...","messageId":"...","sources":[...]}
 *   {"type":"error","message":"..."}   — on failure after stream started
 *
 * Rate limit response (HTTP 429, JSON):
 *   {"error":"rate_limit","message":"...","retryAfterSec":N,"violatedRule":"burst|hourly"}
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retrieveChunks, buildMessages } from "@/lib/snipradar/assistant-kb";
import { getActiveClient } from "@/lib/openrouter-client";
import { openAIClient } from "@/lib/openai";
import {
  consumeSnipRadarRateLimit,
  buildSnipRadarRateLimitHeaders,
  ASSISTANT_CHAT_RATE_LIMIT_RULES,
} from "@/lib/snipradar/request-guards";
import { z } from "zod";
import type { ChatSource } from "@/lib/snipradar/assistant-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatSchema = z.object({
  query: z.string().min(1).max(1000),
  sessionId: z.string().nullish(),
});

const HISTORY_WINDOW = 6;
const encoder = new TextEncoder();

function ndjson(obj: Record<string, unknown>): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

function jsonResponse(body: object, status: number, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = session.user.id;

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rl = consumeSnipRadarRateLimit(
    "assistant:chat",
    userId,
    ASSISTANT_CHAT_RATE_LIMIT_RULES as unknown as { name: string; windowMs: number; maxHits: number }[]
  );
  const rlHeaders = buildSnipRadarRateLimitHeaders(rl) as Record<string, string>;

  if (!rl.allowed) {
    const isHourly = rl.violatedRule === "hourly";
    const friendlyMessage = isHourly
      ? `You've reached your hourly message limit (20 messages). Please wait ${Math.ceil(rl.retryAfterSec / 60)} minute(s) before sending another message.`
      : `You're sending messages too quickly. Please wait ${rl.retryAfterSec} second(s) before trying again.`;

    return jsonResponse(
      {
        error: "rate_limit",
        message: friendlyMessage,
        retryAfterSec: rl.retryAfterSec,
        violatedRule: rl.violatedRule,
      },
      429,
      rlHeaders
    );
  }

  // ── Request body ──────────────────────────────────────────────────────────
  let body: z.infer<typeof ChatSchema>;
  try {
    body = ChatSchema.parse(await req.json());
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { query, sessionId: incomingSessionId } = body;

  // ── Pre-stream setup (wrapped so any error returns a clean JSON 500) ───────
  let resolvedSession: { id: string };
  let messages: ReturnType<typeof buildMessages>;
  let sources: ChatSource[];
  let activeClient: ReturnType<typeof getActiveClient>;

  try {
    // Resolve / create session
    let chatSession = incomingSessionId
      ? await prisma.snipRadarChatSession.findFirst({
          where: { id: incomingSessionId, userId },
        })
      : null;

    if (!chatSession) {
      const title = query.slice(0, 60) + (query.length > 60 ? "…" : "");
      chatSession = await prisma.snipRadarChatSession.create({
        data: { userId, title },
      });
    }

    resolvedSession = chatSession;

    // Load history
    const recentMessages = await prisma.snipRadarChatMessage.findMany({
      where: { sessionId: resolvedSession.id },
      orderBy: { createdAt: "asc" },
      take: HISTORY_WINDOW,
    });

    const history = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // RAG retrieval
    const chunks = await retrieveChunks(query);
    messages = buildMessages(query, chunks, history);
    sources = chunks.map((c) => ({
      docId: c.docId,
      chunkIndex: c.chunkIndex,
      excerpt: c.excerpt,
    }));

    // Persist user message before streaming
    await prisma.snipRadarChatMessage.create({
      data: {
        sessionId: resolvedSession.id,
        role: "user",
        content: query,
        sources: [],
      },
    });

    // Get AI client
    activeClient = getActiveClient(openAIClient, "snipradarAssistant");
  } catch (err) {
    console.error("[Assistant] Pre-stream setup error:", err);
    const detail = process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Internal server error";
    return jsonResponse({ error: detail }, 500, rlHeaders);
  }

  const { client, model } = activeClient;

  // ── Stream ─────────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!client) {
          const fallback =
            "SnipRadar Assistant is not configured. Please contact support.";
          controller.enqueue(ndjson({ type: "token", content: fallback }));

          const msg = await prisma.snipRadarChatMessage.create({
            data: {
              sessionId: resolvedSession.id,
              role: "assistant",
              content: fallback,
              sources: sources as unknown as object[],
            },
          });

          await prisma.snipRadarChatSession.update({
            where: { id: resolvedSession.id },
            data: { updatedAt: new Date() },
          });

          controller.enqueue(
            ndjson({
              type: "done",
              sessionId: resolvedSession.id,
              messageId: msg.id,
              sources,
            })
          );
          controller.close();
          return;
        }

        const completion = await client.chat.completions.create({
          model: model ?? "gpt-4o-mini",
          messages: messages as Parameters<
            typeof client.chat.completions.create
          >[0]["messages"],
          stream: true,
          max_tokens: 800,
          temperature: 0.4,
        });

        let fullAnswer = "";

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content ?? "";
          if (content) {
            fullAnswer += content;
            controller.enqueue(ndjson({ type: "token", content }));
          }
        }

        const assistantMessage = await prisma.snipRadarChatMessage.create({
          data: {
            sessionId: resolvedSession.id,
            role: "assistant",
            content: fullAnswer,
            sources: sources as unknown as object[],
          },
        });

        await prisma.snipRadarChatSession.update({
          where: { id: resolvedSession.id },
          data: { updatedAt: new Date() },
        });

        controller.enqueue(
          ndjson({
            type: "done",
            sessionId: resolvedSession.id,
            messageId: assistantMessage.id,
            sources,
          })
        );
        controller.close();
      } catch (err) {
        console.error("[Assistant Stream] LLM/persist error:", err);
        const detail = process.env.NODE_ENV === "development" && err instanceof Error
          ? err.message
          : "Chat failed";
        controller.enqueue(ndjson({ type: "error", message: detail }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      ...rlHeaders,
    },
  });
}
