// Legacy compatibility endpoint. Active billing uses /api/billing/verify-payment.
export { POST, dynamic, revalidate } from "@/app/api/billing/verify-payment/route";
