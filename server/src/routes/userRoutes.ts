import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { CreateUserSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/users (Managers see all, or filtered by role)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, isActive, search } = req.query;

    const where: any = {};
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { fullName: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        assignedFacilities: {
          select: {
            facilityId: true,
            facility: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      data: users.map((u) => ({
        ...u,
        facilityIds: u.assignedFacilities.map((f) => f.facilityId),
        facilities: u.assignedFacilities.map((f) => f.facility),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users (Manager only)
router.post('/', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = CreateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'A user with this email address already exists.' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        fullName: data.fullName,
        role: data.role as UserRole,
        isActive: true,
        assignedFacilities: data.facilityIds && data.facilityIds.length > 0 ? {
          create: data.facilityIds.map((fId) => ({ facilityId: fId })),
        } : undefined,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/status (Activate / Revoke - Manager only)
router.patch('/:id/status', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'isActive boolean required.' } });
      return;
    }

    if (id === req.user!.id && !isActive) {
      res.status(400).json({ success: false, error: { code: 'SELF_REVOCATION', message: 'You cannot revoke your own account.' } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: isActive ? 'USER_ACTIVATED' : 'USER_REVOKED',
      entityType: 'USER',
      entityId: updated.id,
      details: { isActive },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { id: updated.id, email: updated.email, isActive: updated.isActive },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/role (Change Role - Manager only)
router.patch('/:id/role', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Valid role required.' } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: updated.id,
      details: { newRole: role },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { id: updated.id, role: updated.role },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
