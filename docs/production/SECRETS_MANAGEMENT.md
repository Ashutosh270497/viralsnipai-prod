# Secrets Management

## Source Of Truth

Production and staging secrets must live in:

- Deployment provider environment store
- 1Password / Bitwarden / Google Secret Manager / AWS Secrets Manager

Never rely on shell history, SSH notes, local `.env` files, or chat messages.

## Rules

- Never commit `.env` files.
- Keep `.env.example` and `.env.staging.example` value-free.
- Separate staging and production secrets.
- Rotate secrets after any suspected exposure.
- Limit AI provider keys by budget where possible.

## Rotation Notes

- `NEXTAUTH_SECRET`: rotate with planned user re-login window.
- Google OAuth: rotate in Google Cloud Console.
- OpenAI/OpenRouter: rotate API keys and update deployment env.
- S3: rotate access keys and verify upload/export.
- Razorpay: rotate key secret and webhook secret together.
- SMTP: rotate account/password and test reset email.
- Redis/Upstash: rotate token and verify rate limiting.

## Emergency Leak Response

1. Revoke leaked key immediately.
2. Replace deployment env.
3. Restart app.
4. Check logs for abuse.
5. Notify affected users if customer data may be exposed.
