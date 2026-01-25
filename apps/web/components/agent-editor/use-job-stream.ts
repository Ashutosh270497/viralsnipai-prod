import { useEffect, useState } from "react";

interface AgentJob {
  id: string;
  status: string;
  currentAgent: string | null;
  progress: any;
  resultPath: string | null;
  errorMessage: string | null;
  createdAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
}

export function useJobStream(jobId: string | null) {
  const [job, setJob] = useState<AgentJob | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setIsConnected(false);
      return;
    }

    const eventSource = new EventSource(
      `/api/agent-editor/jobs/${jobId}/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJob(data);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [jobId]);

  return { job, isConnected };
}
