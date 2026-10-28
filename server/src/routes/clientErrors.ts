import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Prisma } from '@prisma/client';
import { clientErrorSchema } from '@busify/shared';
import { recordError } from '../lib/errorLog';
import { parse } from '../lib/http';

export const clientErrorsRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

/**
 * POST /api/client-errors — the web app reports problems it hit (JavaScript
 * errors, GPS failures, map tiles that would not load) for the admin error report.
 */
clientErrorsRouter.post('/', limiter, async (req, res) => {
  const input = parse(clientErrorSchema, req.body);
  await recordError({
    source: 'CLIENT',
    message: input.message,
    stack: input.stack ?? null,
    path: input.path ?? null,
    userId: req.auth?.user.id ?? null,
    userAgent: req.get('user-agent') ?? null,
    context: input.context as Prisma.InputJsonValue | undefined,
  });
  res.status(202).json({ received: true });
});
