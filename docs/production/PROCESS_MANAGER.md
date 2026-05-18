# Process Manager

ViralSnipAI V1 should run as a single web process because the MP4 export queue is currently in memory.

## PM2

Install PM2 on the host:

```bash
npm install -g pm2
```

Start production:

```bash
pnpm install --frozen-lockfile
pnpm --filter web build
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Health check:

```bash
curl -fsS https://YOUR_DOMAIN/api/health/ready
```

Useful commands:

```bash
pm2 status
pm2 logs viralsnipai-web
pm2 restart viralsnipai-web --update-env
pm2 monit
```

Use `WEB_CONCURRENCY=1` for V1. Do not set PM2 `instances` above `1` until exports use a persistent queue such as BullMQ/Redis, Inngest, or a dedicated worker service.

## Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## systemd Alternative

Use systemd only if PM2 is not allowed. The service should run `pnpm --filter web start`, restart on failure, and expose `/api/health/ready` to the host monitor.

## Safe Restart

1. Confirm no critical export is processing if possible.
2. Put the app behind maintenance or low traffic window for larger changes.
3. Run `pm2 restart viralsnipai-web --update-env`.
4. Check `/api/health/ready`.
5. Check recent export jobs.
