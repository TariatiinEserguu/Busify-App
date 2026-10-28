import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal CORS for explicitly configured origins only (CORS_ORIGINS).
 * Not needed when the page and API share an origin, which is the default.
 */
export function corsFor(origins: string[]) {
  const allowed = new Set(origins.map((o) => o.replace(/\/$/, '')));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Busify-Client');
        res.setHeader('Access-Control-Max-Age', '600');
        return res.sendStatus(204);
      }
    }
    next();
  };
}
