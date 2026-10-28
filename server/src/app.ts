import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env, PROJECT_ROOT } from './config/env';
import { authenticate, requireClientHeader } from './middleware/auth';
import { corsFor } from './middleware/cors';
import { apiNotFound, errorHandler } from './middleware/errors';
import { lanOnly } from './middleware/lanOnly';
import { requestLogger } from './middleware/requestLogger';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { busRoutesRouter } from './routes/busRoutes';
import { clientErrorsRouter } from './routes/clientErrors';
import { configRouter } from './routes/config';
import { healthRouter } from './routes/health';
import { journeysRouter } from './routes/journeys';
import { meRouter } from './routes/me';
import { notificationsRouter } from './routes/notifications';
import { stopsRouter } from './routes/stops';
import { supportRouter } from './routes/support';

export const CLIENT_DIST = env.CLIENT_DIST_DIR
  ? path.resolve(env.CLIENT_DIST_DIR)
  : path.join(PROJECT_ROOT, 'client', 'dist');

/** Origins the browser may load map tiles from (for the Content-Security-Policy). */
function tileOrigins(): string[] {
  const template = env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  try {
    const url = new URL(template.replace(/\{[a-z]\}/g, 'a'));
    const origin = `${url.protocol}//${url.host}`;
    if (template.includes('{s}')) return [origin, `${url.protocol}//*.${url.host.split('.').slice(1).join('.')}`];
    return [origin];
  } catch {
    return [];
  }
}

export function createApiRouter() {
  const api = Router();
  api.use(requireClientHeader);
  api.use(authenticate);
  api.use('/health', healthRouter);
  api.use('/config', configRouter);
  api.use('/auth', authRouter);
  api.use('/me', meRouter);
  api.use('/routes', busRoutesRouter);
  api.use('/stops', stopsRouter);
  api.use('/journeys', journeysRouter);
  api.use('/support', supportRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/admin', adminRouter);
  api.use('/client-errors', clientErrorsRouter);
  api.use(apiNotFound);
  return api;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // BUSIFY talks to browsers directly, not through a reverse proxy.
  app.set('trust proxy', false);

  if (env.LAN_ONLY) app.use(lanOnly);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', ...tileOrigins()],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'worker-src': ["'self'"],
          // Over plain-HTTP LAN access, upgrading requests would break the app.
          'upgrade-insecure-requests': env.HTTPS_ENABLED ? [] : null,
        },
      },
      // A self-signed LAN certificate must stay bypassable, so no HSTS.
      strictTransportSecurity: false,
      // OpenStreetMap's tile policy asks for a Referer header.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  if (env.CORS_ORIGINS.length > 0) app.use('/api', corsFor(env.CORS_ORIGINS));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use('/api', createApiRouter());

  if (existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(
      express.static(CLIENT_DIST, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    // Single-page app: every other GET serves index.html and React Router takes over.
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .type('html')
        .send(
          '<!doctype html><meta charset="utf-8"><title>BUSIFY API</title>' +
            '<body style="font-family:system-ui;max-width:640px;margin:48px auto;line-height:1.5">' +
            '<h1>BUSIFY API is running</h1><p>The web app has not been built yet.</p>' +
            '<p>For development run <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a>.<br>' +
            'To serve everything from this port run <code>npm run build</code> and restart.</p>' +
            '<p>Health check: <a href="/api/health">/api/health</a></p></body>',
        );
    });
  }

  app.use(errorHandler);
  return app;
}
