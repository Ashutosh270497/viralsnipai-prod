import { logger } from "@/lib/logger";

type AlertSeverity = "info" | "warning" | "critical";

interface SnipRadarAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
  context?: Record<string, unknown>;
}

const alertWebhookUrl = process.env.SNIPRADAR_ALERT_WEBHOOK_URL?.trim();

export function sendSnipRadarAlert(alert: SnipRadarAlert): void {
  const payload = {
    event: "snipradar_alert",
    timestamp: new Date().toISOString(),
    ...alert,
  };

  if (alert.severity === "critical") {
    logger.error("[SnipRadar Alert] critical", payload);
  } else if (alert.severity === "warning") {
    logger.warn("[SnipRadar Alert] warning", payload);
  } else {
    logger.info("[SnipRadar Alert] info", payload);
  }

  if (!alertWebhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  void fetch(alertWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch((error) => {
      logger.warn("[SnipRadar Alert] webhook dispatch failed", {
        error: error instanceof Error ? error.message : String(error),
        type: alert.type,
      });
    })
    .finally(() => clearTimeout(timeout));
}
