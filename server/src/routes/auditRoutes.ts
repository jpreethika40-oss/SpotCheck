import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);
router.use(requireRoles(UserRole.FACILITY_MANAGER));

// GET /api/v1/audit
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, entityType, actorId, facilityId, page = '1', limit = '30' } = req.query;

    const where: any = {};
    if (action) where.action = { contains: String(action), mode: 'insensitive' };
    if (entityType) where.entityType = String(entityType);
    if (actorId) where.actorId = String(actorId);
    if (facilityId) where.facilityId = String(facilityId);

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit), 10)));

    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
