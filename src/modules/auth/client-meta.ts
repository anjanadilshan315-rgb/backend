import type { Request } from 'express';
import type { ClientMeta } from './token.service.js';

export function clientMeta(req: Request): ClientMeta {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}
