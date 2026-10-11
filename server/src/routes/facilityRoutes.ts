import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { FacilitySchema, ZoneSchema, CheckpointSchema, AssetSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// --- FACILITIES ---

// GET /api/v1/facilities
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, type, isActive } = req.query;

    const where: any = {};

    // Scope check: If inspector or tech, only return assigned facilities
    if (req.user!.role !== UserRole.FACILITY_MANAGER) {
      where.id = { in: req.user!.facilityIds };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { code: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const facilities = await prisma.facility.findMany({
      where,
      include: {
        _count: {
          select: {
            zones: true,
            assets: true,
            inspections: true,
            issues: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: facilities });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/facilities/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user!.role !== UserRole.FACILITY_MANAGER && !req.user!.facilityIds.includes(id)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized for this facility.' } });
      return;
    }

    const facility = await prisma.facility.findUnique({
      where: { id },
      include: {
        zones: {
          include: {
            checkpoints: true,
            _count: { select: { checkpoints: true, assets: true } },
          },
          orderBy: { name: 'asc' },
        },
        assets: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            zones: true,
            checkpoints: true,
            assets: true,
            inspections: true,
            issues: true,
          },
        },
      },
    });

    if (!facility) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Facility not found' } });
      return;
    }

    res.json({ success: true, data: facility });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/facilities (Manager only)
router.post('/', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = FacilitySchema.parse(req.body);

    const facility = await prisma.facility.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        type: data.type,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        squareMeters: data.squareMeters,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        isActive: data.isActive,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'FACILITY_CREATED',
      entityType: 'FACILITY',
      entityId: facility.id,
      details: { name: facility.name, code: facility.code },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: facility });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/facilities/:id (Manager only)
router.put('/:id', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = FacilitySchema.parse(req.body);

    const updated = await prisma.facility.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        type: data.type,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        squareMeters: data.squareMeters,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        isActive: data.isActive,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'FACILITY_UPDATED',
      entityType: 'FACILITY',
      entityId: updated.id,
      details: { name: updated.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// --- ZONES ---

// GET /api/v1/facilities/:facilityId/zones
router.get('/:facilityId/zones', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.params;

    const zones = await prisma.zone.findMany({
      where: { facilityId },
      include: {
        checkpoints: { orderBy: { sequenceOrder: 'asc' } },
        _count: { select: { checkpoints: true, assets: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/facilities/:facilityId/zones (Manager only)
router.post('/:facilityId/zones', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.params;
    const data = ZoneSchema.parse({ ...req.body, facilityId });

    const zone = await prisma.zone.create({
      data: {
        facilityId,
        name: data.name,
        code: data.code.toUpperCase(),
        floor: data.floor,
        description: data.description,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ZONE_CREATED',
      entityType: 'ZONE',
      entityId: zone.id,
      facilityId,
      details: { name: zone.name, code: zone.code },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
});

export default router;
