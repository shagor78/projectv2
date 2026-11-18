import type { Request, Response } from 'express';
import { verifyDatabaseConnection } from '../../../database/index.ts';
import { ensureSeeded } from '../../../database/seeds/seed.ts';

export async function handleHealthCheck(_req: Request, res: Response) {
  try {
    const dbCheck = await verifyDatabaseConnection();
    await ensureSeeded();
    res.json({
      status: 'ok',
      service: 'VEXORA API',
      database: {
        connected: dbCheck.ok,
        latencyMs: dbCheck.latencyMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Health] Database or seed failure:', err);
    res.status(503).json({
      status: 'error',
      service: 'VEXORA API',
      error: err instanceof Error ? err.message : 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
}
