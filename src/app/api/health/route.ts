import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = { ok: false, error: error instanceof Error ? error.message : 'Unknown' };
    logger.error({ err: error }, 'Health check: database failed');
  }

  const allOk = Object.values(checks).every(c => c.ok);
  
  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks,
  }, { status: allOk ? 200 : 503 });
}
