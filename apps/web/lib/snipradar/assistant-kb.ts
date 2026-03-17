/**
 * SnipRadar Assistant — Knowledge Base utilities
 *
 * Handles chunking, embedding, similarity search, and retrieval
 * for the RAG chatbot that powers /snipradar/assistant.
 *
 * Embedding model : openai/text-embedding-3-small (1536 dims) via OpenAI direct
 * Generation model: google/gemini-2.5-flash via OpenRouter (snipradarAssistant key)
 * Storage         : Prisma → snipradar_kb_chunks table (embedding as JSON text)
 */

import { prisma } from "@/lib/prisma";
import { openAIClient } from "@/lib/openai";
import { routedChatCompletion } from "@/lib/openrouter-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbChunk {
  docId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedChunk extends KbChunk {
  similarity: number;
  excerpt: string;
}

export interface ChatSource {
  docId: string;
  chunkIndex: number;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 600;       // characters per chunk (tuned for ~150 tokens)
const CHUNK_OVERLAP = 80;     // character overlap between adjacent chunks
const TOP_K = 5;              // number of chunks to retrieve per query
const EMBEDDING_MODEL = "text-embedding-3-small";

// Suggestion chips shown on the empty state of the assistant
export const SUGGESTION_CHIPS = [
  "How do I schedule my first post on SnipRadar?",
  "What is the Discover feed and how does it work?",
  "How can I use the Hook Generator to write better tweets?",
  "Explain the Viral Score and how it's calculated.",
  "How do I connect my X account and start tracking creators?",
] as const;

// System prompt injected before each generation call
export const ASSISTANT_SYSTEM_PROMPT = `You are the SnipRadar Assistant — an expert guide for the SnipRadar platform (part of ViralSnipAI).

Your job:
1. Answer user questions about SnipRadar features clearly and concisely.
2. Give step-by-step guidance when the user needs to perform an action.
3. Suggest the most relevant feature when the user describes a goal.
4. If the answer involves navigating somewhere in the app, include the path (e.g. "Go to Create → Hook Generator").
5. When uncertain, say so honestly and encourage the user to explore or reach out to support.

Tone: Friendly, direct, knowledgeable. No filler. No hallucinations — only use the provided context.
Format: Use short paragraphs or numbered steps. Markdown is supported.`;

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split a markdown document into overlapping text chunks.
 */
export function chunkDocument(docId: string, text: string): KbChunk[] {
  const chunks: KbChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 30) {
      chunks.push({ docId, chunkIndex: index++, content });
    }

    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

/**
 * Generate an embedding vector for a single text string.
 * Returns null when OpenAI is not configured.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!openAIClient) return null;

  const response = await openAIClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " "),
  });

  return response.data[0]?.embedding ?? null;
}

/**
 * Cosine similarity between two equal-length vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

/**
 * Ingest a document into the KB:
 * 1. Delete existing chunks for that docId (full refresh)
 * 2. Chunk the text
 * 3. Embed each chunk
 * 4. Persist to DB
 */
export async function ingestDocument(
  docId: string,
  text: string
): Promise<{ inserted: number; embedded: number }> {
  // Remove old chunks for this doc
  await prisma.snipRadarKbChunk.deleteMany({ where: { docId } });

  const chunks = chunkDocument(docId, text);
  let embedded = 0;

  for (const chunk of chunks) {
    const vec = await embedText(chunk.content);
    const embedding = vec ? JSON.stringify(vec) : null;
    if (vec) embedded++;

    await prisma.snipRadarKbChunk.create({
      data: {
        docId: chunk.docId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding,
        metadata: JSON.parse(JSON.stringify(chunk.metadata ?? {})),
      },
    });
  }

  return { inserted: chunks.length, embedded };
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve the top-K most relevant chunks for a query using cosine similarity.
 * Falls back to keyword-based ranking when embeddings are unavailable.
 */
export async function retrieveChunks(query: string): Promise<RetrievedChunk[]> {
  const allChunks = await prisma.snipRadarKbChunk.findMany({
    select: { docId: true, chunkIndex: true, content: true, embedding: true },
  });

  if (allChunks.length === 0) return [];

  const queryVec = await embedText(query);

  const scored = allChunks.map((chunk) => {
    let similarity = 0;

    if (queryVec && chunk.embedding) {
      try {
        const chunkVec = JSON.parse(chunk.embedding) as number[];
        similarity = cosineSimilarity(queryVec, chunkVec);
      } catch {
        similarity = keywordSimilarity(query, chunk.content);
      }
    } else {
      // Fallback: simple keyword overlap score
      similarity = keywordSimilarity(query, chunk.content);
    }

    return {
      docId: chunk.docId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      similarity,
      excerpt: chunk.content.slice(0, 200),
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, TOP_K);
}

/**
 * Naive keyword overlap score (0-1) — fallback when embeddings are missing.
 */
function keywordSimilarity(query: string, text: string): number {
  const qWords = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const tWords = text.toLowerCase().split(/\W+/).filter(Boolean);
  const matches = tWords.filter((w) => qWords.has(w)).length;
  return matches / Math.max(qWords.size, 1);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Build the messages array for the generation call given retrieved chunks.
 */
export function buildMessages(
  query: string,
  chunks: RetrievedChunk[],
  history: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const contextBlock =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `--- Source ${i + 1} [${c.docId}] ---\n${c.content}`
          )
          .join("\n\n")
      : "No specific KB context found. Answer based on general SnipRadar knowledge.";

  const systemContent = `${ASSISTANT_SYSTEM_PROMPT}

## Knowledge Base Context
${contextBlock}`;

  return [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: query },
  ];
}

/**
 * Full RAG pipeline: retrieve → build messages → generate.
 */
export async function askAssistant(
  query: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ answer: string; sources: ChatSource[] }> {
  const chunks = await retrieveChunks(query);
  const messages = buildMessages(query, chunks, history);

  const answer = await routedChatCompletion(
    openAIClient,
    "snipradarAssistant",
    "gpt-4o-mini",
    messages as Parameters<typeof routedChatCompletion>[3],
    { maxTokens: 800, temperature: 0.4 }
  );

  const sources: ChatSource[] = chunks.map((c) => ({
    docId: c.docId,
    chunkIndex: c.chunkIndex,
    excerpt: c.excerpt,
  }));

  return { answer, sources };
}
