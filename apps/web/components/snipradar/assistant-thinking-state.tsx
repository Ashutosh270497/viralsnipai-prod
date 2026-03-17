"use client";

import { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Phase = "scanning" | "processing" | "generating";

const PHASE_MESSAGES: Record<Phase, readonly string[]> = {
  scanning: [
    "Analyzing your question...",
    "Reading SnipRadar context...",
    "Searching knowledge base...",
    "Understanding your intent...",
  ],
  processing: [
    "Processing patterns...",
    "Connecting insights...",
    "Thinking through this...",
    "Mapping your answer...",
    "Cross-referencing features...",
  ],
  generating: [
    "Crafting your response...",
    "Almost there...",
    "Writing your answer...",
    "Putting it together...",
    "Finalizing details...",
  ],
};

const PHASE_CONFIG: Record<Phase, { color: string; label: string }> = {
  scanning:   { color: "#34d399", label: "Scanning" },
  processing: { color: "#10b981", label: "Processing" },
  generating: { color: "#6ee7b7", label: "Generating" },
};

// ---------------------------------------------------------------------------
// CSS keyframes (self-contained — no globals.css needed)
// ---------------------------------------------------------------------------

const KEYFRAMES = `
  @keyframes ts-scan-sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  @keyframes ts-wave-dot {
    0%, 100% { transform: scale(1);   opacity: 0.4; }
    50%       { transform: scale(1.6); opacity: 1;   }
  }
  @keyframes ts-cursor-blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0; }
  }
  @keyframes ts-shimmer-fill {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes ts-dot-pulse {
    0%, 100% { opacity: 1;   transform: scale(1);   }
    50%      { opacity: 0.4; transform: scale(0.8); }
  }
  @keyframes ts-enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
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
// Phase-specific animations (fixed 32 px height)
// ---------------------------------------------------------------------------

function ScanningAnimation() {
  return (
    <div className="flex h-full items-center">
      <div
        className="relative flex-1 overflow-hidden"
        style={{ height: 2, borderRadius: 1, background: "rgba(16,185,129,0.12)" }}
      >
        <div
          className="absolute inset-y-0 w-1/4"
          style={{
            background:
              "linear-gradient(90deg, transparent, #059669, #10b981, #059669, transparent)",
            animation: "ts-scan-sweep 1.4s linear infinite",
          }}
        />
      </div>
    </div>
  );
}

function ProcessingAnimation() {
  return (
    <div className="flex h-full items-center gap-2 pl-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 8,
            height: 8,
            background: "#10b981",
            animation: "ts-wave-dot 1.2s ease-in-out infinite",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

function GeneratingAnimation() {
  return (
    <div className="flex h-full items-center gap-3">
      {/* Blinking cursor */}
      <div
        style={{
          width: 2,
          height: 20,
          background: "#10b981",
          borderRadius: 1,
          flexShrink: 0,
          animation: "ts-cursor-blink 1s ease-in-out infinite",
        }}
      />
      {/* Shimmer bar */}
      <div
        className="flex-1"
        style={{
          height: 6,
          borderRadius: 3,
          background:
            "linear-gradient(90deg, rgba(16,185,129,0.12) 25%, rgba(52,211,153,0.45) 50%, rgba(16,185,129,0.12) 75%)",
          backgroundSize: "200% 100%",
          animation: "ts-shimmer-fill 2s linear infinite",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface AssistantThinkingStateProps {
  /** Optionally lock to a specific phase */
  phase?: Phase;
  /** Auto-advance scanning → processing → generating on a timer */
  autoAdvance?: boolean;
}

export function AssistantThinkingState({
  phase: controlledPhase,
  autoAdvance = false,
}: AssistantThinkingStateProps) {
  const [phase, setPhase] = useState<Phase>(controlledPhase ?? "scanning");
  const [phaseVisible, setPhaseVisible] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startRef  = useRef(Date.now());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = (t: ReturnType<typeof setTimeout>) => timersRef.current.push(t);
  const clearAll = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // ── Elapsed counter ──────────────────────────────────────────────────────
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, []);

  // ── Phase auto-advance (scanning → processing → generating) ─────────────
  useEffect(() => {
    if (!autoAdvance) return;
    clearAll();

    const advance = (to: Phase, afterMs: number) => {
      push(
        setTimeout(() => {
          setPhaseVisible(false);
          push(
            setTimeout(() => {
              setPhase(to);
              setMsgIndex(0);
              setPhaseVisible(true);
            }, 250)
          );
        }, afterMs)
      );
    };

    advance("processing", 2000);
    advance("generating", 4250);

    return clearAll;
  }, [autoAdvance]);

  // ── Controlled phase prop ────────────────────────────────────────────────
  useEffect(() => {
    if (controlledPhase !== undefined) {
      setPhase(controlledPhase);
      setMsgIndex(0);
    }
  }, [controlledPhase]);

  // ── Status message cycling ───────────────────────────────────────────────
  useEffect(() => {
    const msgs = PHASE_MESSAGES[phase];
    const id = setInterval(() => {
      setMsgVisible(false);
      const t = setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % msgs.length);
        setMsgVisible(true);
      }, 250);
      push(t);
    }, 1800);
    return () => clearInterval(id);
  }, [phase]);

  const config   = PHASE_CONFIG[phase];
  const messages = PHASE_MESSAGES[phase];
  const elapsed  = Math.min(elapsedMs / 1000, 99.9);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div
        aria-label="Assistant is thinking"
        className="relative overflow-hidden"
        style={{
          maxWidth: "76%",
          minWidth: 260,
          background: "rgba(9,9,9,0.92)",
          border: "1px solid rgba(16,185,129,0.15)",
          borderRadius: "4px 16px 16px 16px",
          padding: "14px 18px 14px 22px",
          animation: "ts-enter 0.3s ease-out both",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
          style={{ background: "linear-gradient(to bottom, #059669, #10b981)" }}
        />

        {/* ── Top row: phase label + elapsed timer ─────────────────────── */}
        <div
          className="mb-3 flex items-center justify-between"
          style={{
            opacity: phaseVisible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background: config.color,
                animation: "ts-dot-pulse 1.5s ease-in-out infinite",
              }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          </div>

          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: "#404040" }}
          >
            {elapsed.toFixed(1)}s
          </span>
        </div>

        {/* ── Middle row: phase animation (fixed 32px) ─────────────────── */}
        <div
          className="mb-3"
          style={{
            height: 32,
            opacity: phaseVisible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          {phase === "scanning"   && <ScanningAnimation />}
          {phase === "processing" && <ProcessingAnimation />}
          {phase === "generating" && <GeneratingAnimation />}
        </div>

        {/* ── Bottom row: cycling status text ──────────────────────────── */}
        <p
          aria-live="polite"
          className="text-[13px] italic"
          style={{
            color: "#525252",
            opacity:   msgVisible ? 1 : 0,
            transform: msgVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 250ms ease, transform 250ms ease",
            minHeight: "1.4em",
          }}
        >
          {messages[msgIndex]}
        </p>
      </div>
    </>
  );
}
