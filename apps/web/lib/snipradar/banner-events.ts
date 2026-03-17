export type BannerVariant = "success" | "info" | "warning";

export interface BannerPayload {
  message: string;
  variant?: BannerVariant;
}

export const BANNER_EVENT = "snipradar:banner";

export function dispatchBanner(payload: BannerPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BANNER_EVENT, { detail: payload }));
}
