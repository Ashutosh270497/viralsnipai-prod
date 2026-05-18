# Load Testing

V1 launch target is controlled beta first, then public launch after staging load tests.

## Basic Health Load

```bash
BASE_URL=https://staging.viralsnipai.com LOAD_CONCURRENCY=10 LOAD_ROUNDS=10 node scripts/load/v1-api-load.js
```

Increase gradually:

- 10 concurrent users
- 25 concurrent users
- 50 concurrent users only if infrastructure supports it

## Pass Thresholds

- p95 health/readiness under 750 ms
- Error rate below 1%
- No memory runaway
- No database connection exhaustion
- Rate limiter does not fall back to memory in production

## Expensive Endpoint Testing

Do not load test real AI/render endpoints against production. Use staging with test accounts and small fixtures. Verify:

- upload rejects oversized files
- generation rate limits repeated calls
- export queue stays stable
- failed renders do not accumulate indefinitely

## Known V1 Limit

Exports use an in-memory queue. Do not horizontally scale app instances during load tests unless a persistent queue has been implemented.
