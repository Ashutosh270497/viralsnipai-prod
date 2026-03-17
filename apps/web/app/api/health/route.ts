import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    environment: { status: 'ok' | 'warn'; missing?: string[] };
  };
}

const REQUIRED_ENV_VARS = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'DATABASE_URL',
];

export async function GET() {
  const start = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
    checks: {
      database: { status: 'ok' },
      environment: { status: 'ok' },
    },
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database.latencyMs = Date.now() - start;
  } catch (error) {
    health.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown DB error',
    };
    health.status = 'unhealthy';
  }

  // Check required env vars
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    health.checks.environment = { status: 'warn', missing };
    if (health.status === 'healthy') health.status = 'degraded';
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
