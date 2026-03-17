/**
 * Export Progress Hook
 *
 * Centralized hook for polling and tracking export progress.
 * Eliminates duplicate polling logic across components.
 *
 * @module use-export-progress
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ExportProgress {
  id: string;
  status: 'pending' | 'queued' | 'processing' | 'done' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
}

export interface UseExportProgressOptions {
  pollInterval?: number;  // Milliseconds between polls (default: 2000)
  onComplete?: (exportId: string, downloadUrl: string) => void;
  onError?: (exportId: string, error: string) => void;
}

/**
 * Hook to manage export progress polling
 *
 * @param exportIds - Array of export IDs to track
 * @param options - Configuration options
 * @returns Export progress map and control functions
 *
 * @example
 * ```tsx
 * const { exports, isPolling, startPolling, stopPolling } = useExportProgress(
 *   ['export-1', 'export-2'],
 *   {
 *     pollInterval: 3000,
 *     onComplete: (id, url) => console.log('Export complete:', id)
 *   }
 * );
 * ```
 */
export function useExportProgress(
  exportIds: string[],
  options: UseExportProgressOptions = {}
) {
  const {
    pollInterval = 2000,
    onComplete,
    onError
  } = options;

  const [exports, setExports] = useState<Map<string, ExportProgress>>(new Map());
  const pollTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep callback refs up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  /**
   * Fetch export status from API
   */
  const fetchExportStatus = useCallback(async (exportId: string): Promise<ExportProgress | null> => {
    try {
      const response = await fetch(`/api/exports/${exportId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch export status');
      }
      const data = await response.json();
      const rawStatus: string | undefined = data.export.status;
      const normalizedStatus =
        rawStatus === 'done' || rawStatus === 'completed'
          ? 'done'
          : rawStatus === 'queued' || rawStatus === 'processing' || rawStatus === 'failed'
            ? rawStatus
            : 'pending';
      return {
        id: exportId,
        status: normalizedStatus,
        progress: data.export.progress || 0,
        downloadUrl: data.export.downloadUrl,
        error: data.export.error
      };
    } catch (error) {
      console.error(`Failed to fetch export ${exportId}:`, error);
      return null;
    }
  }, []);

  /**
   * Stop polling an export
   */
  const stopPolling = useCallback((exportId: string) => {
    const timer = pollTimersRef.current.get(exportId);
    if (timer) {
      clearInterval(timer);
      pollTimersRef.current.delete(exportId);
    }
  }, []);

  /**
   * Start polling an export
   */
  const startPolling = useCallback((exportId: string) => {
    // Don't start if already polling
    if (pollTimersRef.current.has(exportId)) {
      return;
    }

    const poll = async () => {
      const status = await fetchExportStatus(exportId);

      if (status) {
        setExports(prev => new Map(prev).set(exportId, status));

        // Handle completion
        if ((status.status === 'done' || status.status === 'completed') && status.downloadUrl) {
          stopPolling(exportId);
          onCompleteRef.current?.(exportId, status.downloadUrl);
        }

        // Handle failure
        if (status.status === 'failed') {
          stopPolling(exportId);
          onErrorRef.current?.(exportId, status.error || 'Export failed');
        }
      }
    };

    // Poll immediately
    poll();

    // Set up interval
    const timer = setInterval(poll, pollInterval);
    pollTimersRef.current.set(exportId, timer);
  }, [fetchExportStatus, pollInterval, stopPolling]);

  /**
   * Stop all polling
   */
  const stopAll = useCallback(() => {
    pollTimersRef.current.forEach(timer => clearInterval(timer));
    pollTimersRef.current.clear();
  }, []);

  /**
   * Refresh a specific export
   */
  const refresh = useCallback((exportId: string) => {
    stopPolling(exportId);
    startPolling(exportId);
  }, [startPolling, stopPolling]);

  /**
   * Refresh all exports
   */
  const refreshAll = useCallback(() => {
    exportIds.forEach(id => refresh(id));
  }, [exportIds, refresh]);

  // Start polling for all exportIds on mount and when exportIds change
  useEffect(() => {
    exportIds.forEach(id => startPolling(id));

    // Cleanup: stop all polling on unmount
    return () => {
      stopAll();
    };
  }, [exportIds, startPolling, stopAll]);

  return {
    exports,
    isPolling: pollTimersRef.current.size > 0,
    startPolling,
    stopPolling,
    stopAll,
    refresh,
    refreshAll
  };
}
