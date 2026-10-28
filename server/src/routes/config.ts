import { Router } from 'express';
import { env } from '../config/env';
import { getSettings } from '../lib/settings';

export const configRouter = Router();

/** GET /api/config — public, non-secret settings the app needs before sign-in. */
configRouter.get('/', async (_req, res) => {
  const s = await getSettings();
  res.json({
    registrationOpen: s.registrationOpen,
    announcement: s.announcement,
    alert: {
      defaultRadiusM: s.defaultAlertRadiusM,
      minRadiusM: s.minAlertRadiusM,
      maxRadiusM: s.maxAlertRadiusM,
      gpsMaxAccuracyM: s.gpsMaxAccuracyM,
      confirmReadings: s.alertConfirmReadings,
    },
    demoMode: env.DEMO_MODE,
    httpsEnabled: env.HTTPS_ENABLED,
  });
});
