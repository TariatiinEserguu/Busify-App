import type { NextFunction, Request, Response } from 'express';
import { isPrivateAddress } from '../lib/network';
import { logger } from '../lib/logger';

/** Refuses connections from public internet addresses (LAN_ONLY=true). */
export function lanOnly(req: Request, res: Response, next: NextFunction) {
  const remote = req.socket.remoteAddress;
  if (isPrivateAddress(remote)) return next();
  logger.warn(`Blocked request from non-LAN address ${remote} (LAN_ONLY=true)`);
  res.status(403).type('text/plain').send('BUSIFY only accepts connections from the local network.');
}
