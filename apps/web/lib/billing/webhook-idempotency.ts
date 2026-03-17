/**
 * Webhook idempotency guard for Razorpay (and other payment webhooks).
 * Prevents duplicate processing when webhooks are retried.
 *
 * In production at scale, replace the in-memory Set with Redis SETNX.
 */

const processedEventIds = new Set<string>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old events every hour
setInterval(() => {
  // Simple cleanup — in production use Redis TTL instead
  if (processedEventIds.size > 10_000) {
    processedEventIds.clear();
  }
}, 60 * 60 * 1000).unref?.();

/**
 * Check if a webhook event has already been processed.
 * Returns true if this is a NEW event (should be processed).
 * Returns false if this event was ALREADY processed (skip it).
 */
export function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false; // Already processed
  }
  processedEventIds.add(eventId);

  // Auto-remove after TTL
  setTimeout(() => {
    processedEventIds.delete(eventId);
  }, EVENT_TTL_MS).unref?.();

  return true; // New event, process it
}

export function hasEventBeenProcessed(eventId: string): boolean {
  return processedEventIds.has(eventId);
}
