/**
 * API Mutation Hook
 *
 * Provides consistent error handling and toast notifications for API mutations.
 * Eliminates repetitive try-catch blocks across components.
 *
 * @module use-api-mutation
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api/client';

export interface MutationOptions<T> {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  onSuccess?: (data: T) => void | Promise<void>;
  onError?: (error: Error) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export interface MutationState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for handling API mutations with consistent error handling
 *
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * const { mutate, isLoading, error } = useApiMutation<CreateClipResponse>();
 *
 * const handleCreate = async () => {
 *   await mutate(
 *     () => projectsApi.createClip(projectId, clipData),
 *     {
 *       successTitle: 'Clip created',
 *       onSuccess: (data) => console.log('Created:', data)
 *     }
 *   );
 * };
 * ```
 */
export function useApiMutation<T = unknown>() {
  const { toast } = useToast();
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null
  });

  const mutate = useCallback(
    async (
      fn: () => Promise<T>,
      options: MutationOptions<T> = {}
    ): Promise<T | null> => {
      const {
        successTitle,
        successDescription,
        errorTitle = 'Operation failed',
        onSuccess,
        onError,
        showSuccessToast = true,
        showErrorToast = true
      } = options;

      setState({ isLoading: true, error: null });

      try {
        const result = await fn();

        setState({ isLoading: false, error: null });

        // Show success toast
        if (showSuccessToast && successTitle) {
          toast({
            title: successTitle,
            description: successDescription
          });
        }

        // Call success callback
        if (onSuccess) {
          await onSuccess(result);
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');

        setState({ isLoading: false, error: err });

        // Extract error message
        let errorMessage = 'Please try again';
        if (error instanceof ApiError) {
          errorMessage = error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }

        // Show error toast
        if (showErrorToast) {
          toast({
            variant: 'destructive',
            title: errorTitle,
            description: errorMessage
          });
        }

        // Call error callback
        if (onError) {
          onError(err);
        }

        return null;
      }
    },
    [toast]
  );

  return {
    mutate,
    isLoading: state.isLoading,
    error: state.error
  };
}
