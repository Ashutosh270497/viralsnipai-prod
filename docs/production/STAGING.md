# Staging Environment

Staging is required before production launch. Do not use production as the test environment.

## Required Resources

- Staging URL: `https://staging.viralsnipai.com`
- Dedicated staging Postgres/Supabase database
- Dedicated staging S3 bucket
- Razorpay test-mode keys and webhook
- Separate OpenAI/OpenRouter keys or limited-budget keys
- Separate Upstash Redis database
- SMTP sandbox or staging sender

Use `.env.staging.example` as the variable checklist.

## Promotion Flow

1. Merge to `main` after CI passes.
2. Deploy staging.
3. Run migrations against staging.
4. Run smoke checks:
   - `/api/health`
   - `/api/health/ready`
   - Sign up/sign in
   - Upload/import
   - Generate clips
   - Edit transcript
   - Mark export ready
   - Export/download
5. Run payment test-mode checklist.
6. Promote the same commit to production.

## Test Accounts

Maintain at least:

- Free account
- Paid/starter account
- Admin/internal account

Do not reuse production customer accounts in staging.
