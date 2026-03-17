import { useCallback, useEffect, useRef, useState } from "react";

type ProgressState = {
  progress: number;
  phase: string;
  isActive: boolean;
  start: (estimatedDurationMs?: number) => void;
  setPhase: (phase: string, targetProgress: number) => void;
  setAbsolute: (progress: number, phase?: string) => void;
  complete: () => void;
  reset: () => void;
};

/**
 * Realistic progress hook that simulates smooth, decelerating progress
 * over an estimated duration. Supports named phases with target percentages.
 *
 * Unlike a naive linear timer, this uses logarithmic easing that:
 * - Starts fast to feel responsive
 * - Gradually slows down as it approaches the phase target
 * - Never exceeds the phase target until `setPhase` or `complete` is called
 *
 * @param tickMs - How often to update (default 500ms)
 */
export function useProgress(tickMs = 500) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhaseState] = useState("");
  const [isActive, setIsActive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef(90);
  const estimatedRef = useRef(60_000); // default 60s estimated duration
  const startTimeRef = useRef(0);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTicking = useCallback(() => {
    clear();
    timerRef.current = setInterval(() => {
      setProgress((current) => {
        const target = targetRef.current;
        if (current >= target) return current;

        const elapsed = Date.now() - startTimeRef.current;
        const estimated = estimatedRef.current;

        // Logarithmic easing: fast start, slow approach to target
        // ratio goes from 0 → 1 as elapsed approaches estimated duration
        const ratio = Math.min(elapsed / estimated, 1);

        // Use a curve that decelerates: fast early, slow near target
        // log(1 + ratio * 9) / log(10) gives 0→1 with deceleration
        const eased = Math.log10(1 + ratio * 9);

        // Scale to the gap between current start and target
        const ideal = eased * target;

        // Always move forward, but by tiny amounts near the target
        const remaining = target - current;
        const minStep = remaining > 5 ? 0.5 : 0.1;
        const step = Math.max(minStep, remaining * 0.03);

        const next = Math.min(target, Math.max(current + step, ideal));

        return Math.round(next * 10) / 10;
      });
    }, tickMs);
  }, [clear, tickMs]);

  const activeRef = useRef(false);

  const start = useCallback(
    (estimatedDurationMs = 120_000) => {
      // Prevent re-starting if already active
      if (activeRef.current) return;
      activeRef.current = true;
      setIsActive(true);
      setProgress(2);
      setPhaseState("");
      targetRef.current = 90;
      estimatedRef.current = estimatedDurationMs;
      startTimeRef.current = Date.now();
      startTicking();
    },
    [startTicking]
  );

  const setPhase = useCallback(
    (newPhase: string, targetProgress: number) => {
      setPhaseState(newPhase);
      targetRef.current = Math.min(95, targetProgress);
      // Reset timing for this phase so deceleration applies within the phase
      startTimeRef.current = Date.now();
    },
    []
  );

  const setAbsolute = useCallback((nextProgress: number, nextPhase?: string) => {
    const clamped = Math.max(0, Math.min(99, Number(nextProgress) || 0));
    setProgress((current) => {
      // Never move backwards unless reset() is called.
      const next = clamped > current ? clamped : current;
      return Math.round(next * 10) / 10;
    });
    if (nextPhase) {
      setPhaseState(nextPhase);
    }
  }, []);

  const complete = useCallback(() => {
    clear();
    activeRef.current = false;
    setProgress(100);
    setPhaseState("Done");
    setTimeout(() => {
      setIsActive(false);
      setProgress(0);
      setPhaseState("");
    }, 600);
  }, [clear]);

  const reset = useCallback(() => {
    clear();
    activeRef.current = false;
    setIsActive(false);
    setProgress(0);
    setPhaseState("");
  }, [clear]);

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return { progress, phase, isActive, start, setPhase, setAbsolute, complete, reset } satisfies ProgressState;
}
