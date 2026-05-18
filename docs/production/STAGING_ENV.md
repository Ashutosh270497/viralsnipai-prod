# Staging Environment Variables

Use `.env.staging.example` as the template. All values must come from the deployment provider or secrets manager.

Required differences from production:

- `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` point to staging.
- Database is staging-only.
- S3 bucket is staging-only.
- Razorpay uses test-mode keys.
- OAuth redirect URLs include staging callback URLs.
- AI provider keys should have limited budget.
- Upstash Redis is staging-only.

Never point staging at production database, storage bucket, Redis, or Razorpay live webhooks.
