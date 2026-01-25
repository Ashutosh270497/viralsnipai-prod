import { useCallback, useState } from "react";
import type { TrackedOperation, OperationStatus } from "@/components/ui/progress-tracker";

type AddOperationParams = Omit<TrackedOperation, "id" | "createdAt"> & {
  id?: string;
};

export function useProgressTracker() {
  const [operations, setOperations] = useState<TrackedOperation[]>([]);

  const addOperation = useCallback((params: AddOperationParams) => {
    const operation: TrackedOperation = {
      id: params.id || `op-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: params.type,
      name: params.name,
      status: params.status,
      progress: params.progress,
      message: params.message,
      createdAt: new Date()
    };

    setOperations((prev) => [...prev, operation]);
    return operation.id;
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<Omit<TrackedOperation, "id" | "createdAt">>) => {
    setOperations((prev) =>
      prev.map((op) =>
        op.id === id
          ? {
              ...op,
              ...updates
            }
          : op
      )
    );
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setOperations((prev) => prev.filter((op) => op.status !== "completed"));
  }, []);

  const clearAll = useCallback(() => {
    setOperations([]);
  }, []);

  const startOperation = useCallback(
    (params: Omit<AddOperationParams, "status">) => {
      return addOperation({ ...params, status: "processing" });
    },
    [addOperation]
  );

  const completeOperation = useCallback(
    (id: string, message?: string) => {
      updateOperation(id, { status: "completed", progress: 100, message });
      // Auto-remove completed operations after 3 seconds
      setTimeout(() => {
        removeOperation(id);
      }, 3000);
    },
    [updateOperation, removeOperation]
  );

  const failOperation = useCallback(
    (id: string, message?: string) => {
      updateOperation(id, { status: "failed", message });
      // Auto-remove failed operations after 5 seconds
      setTimeout(() => {
        removeOperation(id);
      }, 5000);
    },
    [updateOperation, removeOperation]
  );

  return {
    operations,
    addOperation,
    updateOperation,
    removeOperation,
    clearCompleted,
    clearAll,
    startOperation,
    completeOperation,
    failOperation
  };
}
