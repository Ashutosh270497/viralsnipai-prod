import { validateEnvForStartup } from "@/lib/config/env";

let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const report = validateEnvForStartup();

  if (report.warnings.length > 0 && process.env.NODE_ENV !== "test") {
    console.warn("[ENV] Production readiness warnings:\n" + report.warnings.map((warning) => `  - ${warning}`).join("\n"));
  }

  if (!report.ok && process.env.NODE_ENV !== "production") {
    console.error(
      "[ENV] Missing production-required variables:\n" +
        report.missingRequired.map((key) => `  - ${key}`).join("\n"),
    );
  }
}
