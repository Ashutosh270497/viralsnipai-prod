"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient, UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleClientError } from "@/lib/utils/client-error-handler";

interface OptimisticMutationOptions<TData, TVariables> {
  queryKey: string[];
  successMessage?: string;
  errorMessage?: string;
  optimisticUpdate?: (oldData: any, variables: TVariables) => any;
  mutationFn?: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  onError?: (error: Error, variables: TVariables, context: unknown) => void;
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: unknown) => void;
}

/**
 * Hook for mutations with optimistic UI updates
 */
export function useOptimisticMutation<TData, TVariables>({
  queryKey,
  successMessage,
  errorMessage = "Operation failed",
  optimisticUpdate,
  ...mutationOptions
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const [isOptimistic, setIsOptimistic] = useState(false);

  const mutation = useMutation<TData, Error, TVariables>({
    ...mutationOptions,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      if (optimisticUpdate) {
        setIsOptimistic(true);
        queryClient.setQueryData(queryKey, (old: any) => {
          return optimisticUpdate(old, variables);
        });
      }

      // Call user's onMutate if provided
      await mutationOptions.onMutate?.(variables);

      // Return context with snapshotted value
      return { previousData };
    },
    onError: (error, variables, context: any) => {
      // Revert optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }

      setIsOptimistic(false);

      // Show error message
      handleClientError(error, errorMessage);

      // Call user's onError if provided
      mutationOptions.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      setIsOptimistic(false);

      // Show success message
      if (successMessage) {
        toast.success(successMessage);
      }

      // Call user's onSuccess if provided
      mutationOptions.onSuccess?.(data, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      // Refetch to ensure data is in sync
      queryClient.invalidateQueries({ queryKey });

      // Call user's onSettled if provided
      mutationOptions.onSettled?.(data, error, variables, context);
    },
  });

  return {
    ...mutation,
    isOptimistic,
  };
}

/**
 * Hook for simple mutations without optimistic updates
 */
export function useSimpleMutation<TData, TVariables>({
  mutationFn,
  successMessage,
  errorMessage = "Operation failed",
  onSuccess,
  invalidateQueries,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
  invalidateQueries?: string[][];
}) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (data) => {
      if (successMessage) {
        toast.success(successMessage);
      }

      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }

      onSuccess?.(data);
    },
    onError: (error) => {
      handleClientError(error, errorMessage);
    },
  });
}
