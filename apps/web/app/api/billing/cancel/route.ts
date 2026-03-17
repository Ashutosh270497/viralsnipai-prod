// Legacy compatibility endpoint. Active billing uses /api/billing/cancel-subscription.
export { POST, dynamic, revalidate } from "@/app/api/billing/cancel-subscription/route";
