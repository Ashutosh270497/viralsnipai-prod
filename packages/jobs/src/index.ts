type JobStatus = "pending" | "processing" | "done" | "failed";

export interface RenderJob {
  exportId: string;
  handler: () => Promise<void>;
  onStatusChange?: (status: JobStatus, error?: unknown) => void;
}

const jobQueue: RenderJob[] = [];
let isRunning = false;

export function enqueueRender(job: RenderJob) {
  jobQueue.push(job);
}

async function processNextJob() {
  if (jobQueue.length === 0) {
    return;
  }

  const job = jobQueue.shift();
  if (!job) {
    return;
  }

  try {
    job.onStatusChange?.("processing");
    await job.handler();
    job.onStatusChange?.("done");
  } catch (error) {
    job.onStatusChange?.("failed", error);
  }
}

export function processJobs(intervalMs = 1500) {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const timer = setInterval(() => {
    void processNextJob();
  }, intervalMs);

  return () => {
    clearInterval(timer);
    isRunning = false;
  };
}
