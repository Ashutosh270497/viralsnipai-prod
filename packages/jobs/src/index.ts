type JobStatus = "pending" | "processing" | "done" | "failed";

export interface RenderJob {
  exportId: string;
  handler: () => Promise<void>;
  onStatusChange?: (status: JobStatus, error?: unknown) => void;
}

const jobQueue: RenderJob[] = [];
let isRunning = false;
let isProcessing = false;
let loopTimer: NodeJS.Timeout | null = null;

export function enqueueRender(job: RenderJob) {
  jobQueue.push(job);
  // Trigger immediate processing so jobs do not wait for the next timer tick.
  void processNextJob();
}

async function safeStatusChange(job: RenderJob, status: JobStatus, error?: unknown) {
  try {
    await job.onStatusChange?.(status, error);
  } catch (callbackError) {
    // Never let status callback failures strand queue processing.
    console.error("[jobs] status callback failed", { status, callbackError });
  }
}

async function processNextJob() {
  if (isProcessing) {
    return;
  }

  if (jobQueue.length === 0) {
    return;
  }

  const job = jobQueue[0];
  if (!job) {
    return;
  }

  isProcessing = true;
  try {
    await safeStatusChange(job, "processing");
    await job.handler();
    await safeStatusChange(job, "done");
  } catch (error) {
    await safeStatusChange(job, "failed", error);
  } finally {
    jobQueue.shift();
    isProcessing = false;
    // Process remaining jobs without waiting for the next timer tick.
    if (jobQueue.length > 0) {
      void processNextJob();
    }
  }
}

export function processJobs(intervalMs = 1500) {
  if (isRunning) {
    return;
  }

  isRunning = true;
  loopTimer = setInterval(() => {
    void processNextJob();
  }, intervalMs);

  return () => {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
    isRunning = false;
  };
}
