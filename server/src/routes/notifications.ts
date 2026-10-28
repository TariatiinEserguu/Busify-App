import { Router } from 'express';
import { idParam, notFound } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

/** GET /api/notifications — latest notifications for the signed-in user. */
notificationsRouter.get('/', async (req, res) => {
  const userId = req.auth!.user.id;
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  res.json({ notifications, unread });
});

/** POST /api/notifications/:id/read */
notificationsRouter.post('/:id/read', async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: idParam(req.params.id, 'Notification'), userId: req.auth!.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.count({ where: { id: Number(req.params.id), userId: req.auth!.user.id } });
    if (!exists) throw notFound('Notification');
  }
  res.status(204).end();
});

/** POST /api/notifications/read-all */
notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.auth!.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});
