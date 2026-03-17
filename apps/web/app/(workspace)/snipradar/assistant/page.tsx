"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Send, Plus, Trash2, Loader2, Sparkles,
  ExternalLink, Calendar, Compass, Zap, TrendingUp, Users, ArrowRight,
} from "lucide-react";
import { AssistantThinkingState } from "@/components/snipradar/assistant-thinking-state";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Animation keyframes (pure CSS — no external library)
// ---------------------------------------------------------------------------

const KEYFRAMES = `
  @keyframes orb-enter {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1);   }
  }
  @keyframes orb-pulse {
    0%,100% { transform: scale(1);    box-shadow: 0 0 40px 10px rgba(16,185,129,0.25); }
    50%     { transform: scale(1.08); box-shadow: 0 0 60px 20px rgba(52,211,153,0.35); }
  }
  @keyframes orbit {
    from { transform: rotate(0deg)   translateX(52px) rotate(0deg);   }
    to   { transform: rotate(360deg) translateX(52px) rotate(-360deg); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes word-fade {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes slide-up-bar {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// ---------------------------------------------------------------------------
// KB docId → route map
// ---------------------------------------------------------------------------

const DOC_ROUTE_MAP: Record<string, string> = {
  "snipradar-platform-overview":       "/snipradar/overview",
  "snipradar-getting-started":         "/snipradar/overview",
  "snipradar-connect-x-account":       "/snipradar/overview",
  "snipradar-overview-dashboard":      "/snipradar/overview",
  "snipradar-discover-tracker":        "/snipradar/discover",
  "snipradar-discover-viral":          "/snipradar/discover",
  "snipradar-discover-engagement":     "/snipradar/discover",
  "snipradar-inbox":                   "/snipradar/inbox",
  "snipradar-relationships":           "/snipradar/relationships",
  "snipradar-create-drafts":           "/snipradar/create",
  "snipradar-create-hooks":            "/snipradar/create",
  "snipradar-create-threads":          "/snipradar/create",
  "snipradar-create-templates":        "/snipradar/create",
  "snipradar-create-research":         "/snipradar/create",
  "snipradar-create-style":            "/snipradar/create",
  "snipradar-create-predictor":        "/snipradar/create",
  "snipradar-publish-scheduler":       "/snipradar/publish",
  "snipradar-publish-calendar":        "/snipradar/publish",
  "snipradar-publish-best-times":      "/snipradar/publish",
  "snipradar-publish-automations":     "/snipradar/publish",
  "snipradar-publish-api":             "/snipradar/publish",
  "snipradar-analytics":               "/snipradar/analytics",
  "snipradar-growth-planner":          "/snipradar/growth",
  "snipradar-assistant-how-to-use":    "/snipradar/assistant",
  "snipradar-browser-extension":       "/snipradar/overview",
  "snipradar-billing-plans":           "/billing",
  "snipradar-troubleshooting":         "/snipradar/overview",
  "snipradar-tips-and-best-practices": "/snipradar/overview",
  "snipradar-faq":                     "/snipradar/overview",
};

// ---------------------------------------------------------------------------
// Suggestion cards data (with icons + layout flag)
// ---------------------------------------------------------------------------

const CARD_ITEMS = [
  {
    Icon: Calendar,
    question: "How do I schedule my first post on SnipRadar?",
    full: true,
    delay: 0,
  },
  {
    Icon: Compass,
    question: "What is the Discover feed and how does it work?",
    full: false,
    delay: 100,
  },
  {
    Icon: Zap,
    question: "How can I use the Hook Generator to write better tweets?",
    full: false,
    delay: 200,
  },
  {
    Icon: TrendingUp,
    question: "Explain the Viral Score and how it's calculated.",
    full: false,
    delay: 300,
  },
  {
    Icon: Users,
    question: "How do I connect my X account and start tracking creators?",
    full: false,
    delay: 400,
  },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ docId: string; chunkIndex: number; excerpt: string }>;
  isRateLimit?: boolean;
}

interface ChatSession {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

// ---------------------------------------------------------------------------
// MessageBubble — logic & markdown rendering unchanged
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  isStreaming = false,
  onNavigate,
}: {
  message: Message;
  isStreaming?: boolean;
  onNavigate: (route: string) => void;
}) {
  const isUser = message.role === "user";
  const isRateLimit = message.isRateLimit === true;
  const isThinking = !isUser && isStreaming && !message.content;

  // ── Thinking state: replace bubble entirely with rich animated indicator ─
  if (isThinking) {
    return (
      <div className="flex gap-3 flex-row">
        <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10">
          <Sparkles className="h-4 w-4 text-[#10b981]" />
        </div>
        <AssistantThinkingState autoAdvance={true} />
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
          isUser
            ? "text-white"
            : "bg-white/[0.06] border border-white/10"
        )}
        style={isUser ? { background: "linear-gradient(135deg, #047857, #10b981)" } : undefined}
      >
        {isUser ? "You" : <Sparkles className="h-4 w-4 text-[#10b981]" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "text-white rounded-tr-sm"
            : isRateLimit
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-tl-sm"
            : "bg-white/[0.04] border border-white/[0.08] text-[#E2E8F0] rounded-tl-sm backdrop-blur-sm"
        )}
        style={isUser ? { background: "linear-gradient(135deg, #047857, #10b981)" } : undefined}
      >
        {isUser || isRateLimit ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-assistant">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ol:         ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
                ul:         ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
                li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong:     ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                em:         ({ children }) => <em className="italic">{children}</em>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code className="block mt-1 mb-2 rounded-md bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre text-[#34d399]">
                      {children}
                    </code>
                  ) : (
                    <code className="rounded bg-black/30 border border-white/10 px-1 py-0.5 font-mono text-[11px] text-[#34d399]">
                      {children}
                    </code>
                  );
                },
                pre:        ({ children }) => <pre className="not-prose">{children}</pre>,
                h1:         ({ children }) => <h1 className="mb-1 mt-2 text-base font-bold text-white first:mt-0">{children}</h1>,
                h2:         ({ children }) => <h2 className="mb-1 mt-2 text-sm font-bold text-white first:mt-0">{children}</h2>,
                h3:         ({ children }) => <h3 className="mb-1 mt-1.5 text-sm font-semibold text-white/90 first:mt-0">{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="text-[#34d399] underline underline-offset-2 opacity-80 hover:opacity-100">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-[#10b981]/60 pl-3 italic opacity-80">{children}</blockquote>
                ),
                hr: () => <hr className="my-2 border-white/10" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-0.5 h-[1em] bg-[#10b981] ml-0.5 align-text-bottom animate-pulse" />
            )}
          </div>
        )}

        {/* Source chips */}
        {!isUser && !isRateLimit && message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.sources.slice(0, 3).map((src, i) => {
              const route = DOC_ROUTE_MAP[src.docId];
              const label = src.docId.replace("snipradar-", "").replace(/-/g, " ");
              return route ? (
                <button
                  key={i}
                  onClick={() => onNavigate(route)}
                  title={`Go to ${label}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-100"
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#34d399",
                  }}
                >
                  {label}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </button>
              ) : (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#34d399",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedOrb
// ---------------------------------------------------------------------------

function AnimatedOrb() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Orbit ring dots */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            width: 5,
            height: 5,
            marginTop: -2.5,
            marginLeft: -2.5,
            animation: `orbit 8s linear ${-i}s infinite`,
          }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: i % 2 === 0 ? "#34d399" : "#10b981",
              opacity: 0.5 + (i % 3) * 0.15,
            }}
          />
        </div>
      ))}

      {/* Core orb */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 72,
          height: 72,
          background:
            "radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 45%, #047857 100%)",
          animation:
            "orb-enter 0.8s ease-out forwards, orb-pulse 3s ease-in-out 0.8s infinite",
        }}
      >
        <Sparkles className="h-7 w-7 text-white/90" />
      </div>

      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
          animation: "orb-enter 0.8s ease-out forwards, orb-pulse 3s ease-in-out 0.8s infinite",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — magnetic hero screen
// ---------------------------------------------------------------------------

function EmptyState({ onChipClick }: { onChipClick: (text: string) => void }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-8">

      {/* Atmospheric background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Top-left blob */}
        <div
          className="absolute -top-48 -left-48"
          style={{
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Bottom-right blob */}
        <div
          className="absolute -bottom-32 -right-32"
          style={{
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Animated orb */}
        <AnimatedOrb />

        {/* Heading — word-level stagger */}
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#F8FAFC]">
          <span
            className="inline-block"
            style={{ animation: "word-fade 0.5s ease-out 0ms both" }}
          >
            SnipRadar
          </span>{" "}
          <span
            className="inline-block text-[#10b981]"
            style={{ animation: "word-fade 0.5s ease-out 150ms both" }}
          >
            Assistant
          </span>
        </h2>

        {/* Subtitle */}
        <p
          className="mt-2 max-w-sm text-sm text-[#94A3B8]"
          style={{ animation: "fade-up 0.5s ease-out 500ms both" }}
        >
          Your AI guide to every SnipRadar feature. Ask anything about growing
          on&nbsp;X, scheduling posts, or using any tool on the platform.
        </p>

        {/* Suggestion cards */}
        <div
          className="mt-8 w-full max-w-2xl"
          style={{ animation: "fade-in 0.4s ease-out 300ms both" }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CARD_ITEMS.map(({ Icon, question, full, delay }, idx) => (
              <button
                key={idx}
                onClick={() => onChipClick(question)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-left backdrop-blur-md transition-all duration-200",
                  "hover:border-[#10b981]/40 hover:bg-[#10b981]/[0.06]",
                  full && "sm:col-span-2"
                )}
                style={{ animation: `fade-up 0.5s ease-out ${delay}ms both` }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                  style={{
                    background: "linear-gradient(to bottom, #047857, #10b981)",
                  }}
                />

                <div className="flex items-start gap-3 pl-2">
                  {/* Icon */}
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Question text */}
                  <span className="flex-1 text-[15px] font-medium leading-snug text-[#E2E8F0]">
                    {question}
                  </span>

                  {/* Arrow */}
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B] opacity-40 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100"
                    style={{ color: "inherit" }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionItem — emerald accent on active
// ---------------------------------------------------------------------------

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm transition-all duration-150",
        isActive
          ? "pl-2.5 text-[#10b981]"
          : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#E2E8F0]"
      )}
      style={isActive ? {
        borderLeft: "3px solid #10b981",
        background: "rgba(16,185,129,0.10)",
      } : undefined}
      onClick={onSelect}
    >
      <MessageSquare className="mr-2 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{session.title ?? "New conversation"}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-1 hidden rounded p-0.5 text-[#475569] hover:text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssistantPage — all logic preserved, visual layer elevated
// ---------------------------------------------------------------------------

export default function AssistantPage() {
  const { data: authSession } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/snipradar/assistant/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } finally {
      setSessionsLoading(false);
    }
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setQuery("");

      const tempUserId = `temp-user-${Date.now()}`;
      const tempAssistantId = `temp-assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: tempUserId, role: "user", content: trimmed },
        { id: tempAssistantId, role: "assistant", content: "" },
      ]);
      setStreamingMessageId(tempAssistantId);
      setLoading(true);

      try {
        const res = await fetch("/api/snipradar/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            ...(activeSessionId ? { sessionId: activeSessionId } : {}),
          }),
        });

        if (res.status === 429) {
          let rlMessage =
            "You're sending messages too quickly. Please wait a moment and try again.";
          try {
            const rlData = (await res.json()) as { message?: string };
            if (rlData.message) rlMessage = rlData.message;
          } catch { /* use default */ }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? { ...m, content: rlMessage, isRateLimit: true }
                : m
            )
          );
          return;
        }

        if (!res.ok || !res.body) {
          let errMsg = "Something went wrong. Please try again.";
          try {
            const errData = (await res.json()) as { error?: string };
            if (errData.error) errMsg = errData.error;
          } catch { /* use default */ }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, content: errMsg } : m
            )
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              const event = JSON.parse(trimmedLine) as {
                type: "token" | "done" | "error";
                content?: string;
                sessionId?: string;
                messageId?: string;
                sources?: Array<{
                  docId: string;
                  chunkIndex: number;
                  excerpt: string;
                }>;
                message?: string;
              };

              if (event.type === "token" && event.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAssistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === "done") {
                setActiveSessionId(event.sessionId!);
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === tempUserId)
                      return { ...m, id: `user-${event.messageId}` };
                    if (m.id === tempAssistantId)
                      return {
                        ...m,
                        id: event.messageId!,
                        sources: event.sources ?? [],
                      };
                    return m;
                  })
                );
                fetchSessions();
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAssistantId
                      ? {
                          ...m,
                          content:
                            event.message ??
                            "Something went wrong. Please try again.",
                        }
                      : m
                  )
                );
                return;
              }
            } catch {
              // Non-JSON line — skip silently
            }
          }
        }
      } catch (err) {
        console.error("[Assistant] sendMessage error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? {
                  ...m,
                  content:
                    "Something went wrong. Please try again or refresh the page.",
                }
              : m
          )
        );
      } finally {
        setStreamingMessageId(null);
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [activeSessionId, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(query);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setQuery("");
    textareaRef.current?.focus();
  };

  const selectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const res = await fetch(
        `/api/snipradar/assistant/sessions/${sessionId}/messages`
      );
      if (res.ok) {
        const data = await res.json();
        const loaded: Message[] = (data.messages ?? []).map(
          (m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            sources?: Array<{
              docId: string;
              chunkIndex: number;
              excerpt: string;
            }>;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources ?? [],
          })
        );
        setMessages(loaded);
      }
    } finally {
      setMessagesLoading(false);
      textareaRef.current?.focus();
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/snipradar/assistant/sessions?id=${sessionId}`, {
        method: "DELETE",
      });
      if (activeSessionId === sessionId) startNewChat();
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // silent
    }
  };

  const hasMessages = messages.length > 0 || messagesLoading;

  return (
    <>
      {/* Inject animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

        {/* ---------------------------------------------------------------- */}
        {/* Sidebar — session history                                        */}
        {/* ---------------------------------------------------------------- */}
        <aside
          className="hidden w-56 shrink-0 flex-col md:flex"
          style={{
            background: "rgba(9,9,9,0.9)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#525252]">
              History
            </span>
            <button
              onClick={startNewChat}
              className="group flex h-6 w-6 items-center justify-center rounded-md text-[#525252] transition-all duration-200 hover:text-[#10b981]"
              style={{ background: "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-[#525252]" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-[#525252]">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => selectSession(s.id)}
                    onDelete={() => deleteSession(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Main chat area                                                   */}
        {/* ---------------------------------------------------------------- */}
        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: "#080808" }}
        >
          {/* Header bar */}
          <div
            className="flex shrink-0 items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: "rgba(16,185,129,0.15)" }}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
              </div>
              <span className="text-sm font-semibold text-[#F5F5F5]">
                SnipRadar Assistant
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(16,185,129,0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                AI
              </span>
            </div>
            {hasMessages && (
              <button
                onClick={startNewChat}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#737373] transition-all duration-150 hover:bg-white/[0.04] hover:text-[#E5E5E5]"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </button>
            )}
          </div>

          {/* Messages / Empty state */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            {messagesLoading ? (
              <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}
                  >
                    <div className="shrink-0 h-8 w-8 rounded-full bg-white/[0.06] animate-pulse" />
                    <div
                      className={`h-14 rounded-2xl bg-white/[0.04] animate-pulse ${
                        i % 2 === 0 ? "w-48" : "w-72"
                      }`}
                    />
                  </div>
                ))}
              </div>
            ) : !hasMessages ? (
              <EmptyState onChipClick={(chip) => sendMessage(chip)} />
            ) : (
              <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-6">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={msg.id === streamingMessageId}
                    onNavigate={(route) => router.push(route)}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar — pill design */}
          <div
            className="shrink-0 px-4 py-4"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(8,8,8,0.95)",
              backdropFilter: "blur(12px)",
              animation: "slide-up-bar 0.5s ease-out 600ms both",
            }}
          >
            <div className="mx-auto flex w-full max-w-2xl items-end gap-3">
              {/* Pill textarea wrapper */}
              <div
                className="relative flex-1 transition-all duration-200"
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                }}
                onFocusCapture={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "#10b981";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 0 0 3px rgba(16,185,129,0.12)";
                }}
                onBlurCapture={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <Textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about SnipRadar…"
                  rows={1}
                  disabled={loading || messagesLoading}
                  className="min-h-[44px] max-h-[160px] w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-[#E5E5E5] placeholder:text-[#525252] focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ borderRadius: 20 }}
                />
              </div>

              {/* Send button — filled circle with emerald */}
              <button
                disabled={!query.trim() || loading || messagesLoading}
                onClick={() => sendMessage(query)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
                style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="mt-2 text-center text-[11px] text-[#404040]">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
