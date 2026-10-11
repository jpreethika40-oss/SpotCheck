import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/notifications
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notifications = await prisma.appNotification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.appNotification.count({
      where: { userId: req.user!.id, isRead: false },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const notif = await prisma.appNotification.updateMany({
      where: { id, userId: req.user!.id },
      data: { isRead: true },
    });

    res.json({ success: true, updated: notif.count > 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/mark-all-read
router.post('/mark-all-read', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.appNotification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

export default router;
