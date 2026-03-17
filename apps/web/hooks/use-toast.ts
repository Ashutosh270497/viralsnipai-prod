import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (props: Omit<Toast, "id">) => {
      const id = (++toastCount).toString();
      const newToast = { ...props, id };
      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);

      return {
        id,
        dismiss: () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      };
    },
    []
  );

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return {
    toast,
    dismiss,
    toasts,
  };
}
