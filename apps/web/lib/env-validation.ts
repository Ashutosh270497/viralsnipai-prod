/**
 * Startup environment variable validation.
 * Import this at the top of any server-side entrypoint to catch
 * missing config before serving any requests.
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_SCHEMA: EnvVar[] = [
  // Auth
  { key: 'NEXTAUTH_SECRET', required: true, description: 'NextAuth JWT secret (must be rotated from default)' },
  { key: 'NEXTAUTH_URL', required: true, description: 'Public app URL for NextAuth callbacks' },
  // Database
  { key: 'DATABASE_URL', required: true, description: 'MySQL/PostgreSQL connection string' },
  // Google OAuth
  { key: 'GOOGLE_CLIENT_ID', required: false, description: 'Google OAuth client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', required: false, description: 'Google OAuth client secret' },
  // AI providers
  { key: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key (or set OPENROUTER_API_KEY)' },
  { key: 'OPENROUTER_API_KEY', required: false, description: 'OpenRouter API key' },
  // X / Twitter OAuth (required for SnipRadar core features)
  { key: 'X_CLIENT_ID', required: false, description: 'X OAuth 2.0 client ID — required for X account connection' },
  { key: 'X_CLIENT_SECRET', required: false, description: 'X OAuth 2.0 client secret — required for X account connection' },
  // Billing — Razorpay
  { key: 'RAZORPAY_KEY_ID', required: false, description: 'Razorpay API key ID' },
  { key: 'RAZORPAY_KEY_SECRET', required: false, description: 'Razorpay API key secret' },
  { key: 'RAZORPAY_WEBHOOK_SECRET', required: false, description: 'Razorpay webhook signature secret' },
  // SnipRadar cron security — scheduled posts will not fire if missing
  { key: 'SNIPRADAR_SCHEDULER_CRON_SECRET', required: false, description: 'Cron auth secret for scheduled post execution' },
  // SnipRadar assistant KB
  { key: 'INGEST_SECRET', required: false, description: 'Auth secret for assistant knowledge base ingestion endpoint' },
];

let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_SCHEMA) {
    const value = process.env[envVar.key];
    if (!value) {
      if (envVar.required) {
        missing.push(`  ❌ ${envVar.key}: ${envVar.description}`);
      } else {
        warnings.push(`  ⚠️  ${envVar.key}: ${envVar.description}`);
      }
    }
  }

  // Check that at least one AI provider is configured
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    warnings.push('  ⚠️  No AI provider configured (OPENAI_API_KEY or OPENROUTER_API_KEY required for AI features)');
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('[ENV] Optional variables not set:\n' + warnings.join('\n'));
  }

  if (missing.length > 0) {
    const message = '[ENV] Required environment variables are missing:\n' + missing.join('\n');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}
