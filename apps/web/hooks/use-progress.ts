import { useCallback, useEffect, useRef, useState } from "react";

type ProgressState = {
  progress: number;
  isActive: boolean;
  start: () => void;
  complete: () => void;
  reset: () => void;
};

export function useProgress(speed = 250) {
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (isActive) return;
    setIsActive(true);
    setProgress(5);

    clear();
    timerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 90) {
          return current;
        }
        const next = current + Math.max(2, Math.round((100 - current) * 0.08));
        return Math.min(next, 90);
      });
    }, speed);
  }, [clear, isActive, speed]);

  const complete = useCallback(() => {
    clear();
    setProgress(100);
    setTimeout(() => {
      setIsActive(false);
      setProgress(0);
    }, 400);
  }, [clear]);

  const reset = useCallback(() => {
    clear();
    setIsActive(false);
    setProgress(0);
  }, [clear]);

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return { progress, isActive, start, complete, reset } satisfies ProgressState;
}
