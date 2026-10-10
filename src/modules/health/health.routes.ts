import { Router } from 'express';
import type { Request, Response } from 'express';
import { pingDatabase } from '../../config/database.js';

export const healthRouter = Router();

/** Liveness + database check for load balancers and uptime monitors. */
healthRouter.get('/', async (_req: Request, res: Response) => {
  let database: 'up' | 'down' = 'up';
  try {
    await pingDatabase();
  } catch {
    database = 'down';
  }
  const healthy = database === 'up';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});
