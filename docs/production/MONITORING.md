# Monitoring And Alerts

## Health Endpoints

- Public liveness: `/api/health`
- Deployment readiness: `/api/health/ready`

Both endpoints avoid secret values. Readiness returns `503` when required services are unhealthy.

## Recommended Tools

- Uptime: BetterStack or UptimeRobot
- Error tracking: Sentry
- Logs: BetterStack Logs, Axiom, Datadog, or CloudWatch

## Required Alerts

- App down or `/api/health/ready` unhealthy
- Database check failing
- Export failure rate spike
- Export queue stuck
- API 500 spike
- Upload/storage errors
- Razorpay webhook failures
- Disk/memory pressure
- Rate limiter using memory fallback in production

## Daily Launch Checks

1. Review errors from the last 24 hours.
2. Check export queue health.
3. Check failed exports.
4. Check Razorpay webhook delivery.
5. Check storage errors.
6. Check rate-limit and quota blocks.

## Logging Rules

Logs must not contain raw passwords, tokens, cookies, transcript text, full captions, or large request bodies. Use `sanitizeForLog()` before adding sensitive payloads to structured logs.
