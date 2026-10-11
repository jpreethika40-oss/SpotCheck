import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { CheckpointSchema, AssetSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// --- CHECKPOINTS ---

// GET /api/v1/checkpoints
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId, zoneId, search } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);
    if (zoneId) where.zoneId = String(zoneId);
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { code: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const checkpoints = await prisma.checkpoint.findMany({
      where,
      include: {
        zone: { select: { id: true, name: true, code: true } },
        facility: { select: { id: true, name: true, code: true } },
        assets: { select: { id: true, name: true, assetTag: true, status: true } },
      },
      orderBy: { sequenceOrder: 'asc' },
    });

    res.json({ success: true, data: checkpoints });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/checkpoints/by-token/:token (QR Code Scanner Resolution)
router.get('/by-token/:token', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;

    const checkpoint = await prisma.checkpoint.findUnique({
      where: { qrCodeToken: token },
      include: {
        zone: true,
        facility: true,
        assets: true,
      },
    });

    if (!checkpoint) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CHECKPOINT_NOT_FOUND',
          message: 'No checkpoint found matching this QR code identifier.',
        },
      });
      return;
    }

    // Server-side authorization check: verify inspector/tech has access to this facility
    if (req.user!.role !== UserRole.FACILITY_MANAGER && !req.user!.facilityIds.includes(checkpoint.facilityId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FACILITY_ACCESS_DENIED',
          message: 'You are not assigned to the facility this QR checkpoint belongs to.',
        },
      });
      return;
    }

    res.json({ success: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/checkpoints (Manager only)
router.post('/', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = CheckpointSchema.parse(req.body);

    const zone = await prisma.zone.findUnique({
      where: { id: data.zoneId },
    });
    if (!zone) {
      res.status(404).json({ success: false, error: { code: 'ZONE_NOT_FOUND', message: 'Zone not found' } });
      return;
    }

    // Generate unique opaque QR token
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const qrCodeToken = `QR-SC-${data.code.toUpperCase()}-${randomHex}`;

    const checkpoint = await prisma.checkpoint.create({
      data: {
        zoneId: data.zoneId,
        facilityId: zone.facilityId,
        name: data.name,
        code: data.code.toUpperCase(),
        qrCodeToken,
        locationDescription: data.locationDescription,
        instructions: data.instructions,
        sequenceOrder: data.sequenceOrder,
        isActive: data.isActive,
      },
      include: { zone: true, facility: true },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CHECKPOINT_CREATED',
      entityType: 'CHECKPOINT',
      entityId: checkpoint.id,
      facilityId: zone.facilityId,
      details: { name: checkpoint.name, qrCodeToken },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/checkpoints/:id (Manager only)
router.put('/:id', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = CheckpointSchema.parse(req.body);

    const updated = await prisma.checkpoint.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        locationDescription: data.locationDescription,
        instructions: data.instructions,
        sequenceOrder: data.sequenceOrder,
        isActive: data.isActive,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// --- ASSETS ---

// GET /api/v1/assets
router.get('/assets', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId, category, status, search } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { assetTag: { contains: String(search), mode: 'insensitive' } },
        { modelNumber: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, name: true, code: true } },
        checkpoint: { select: { id: true, name: true, code: true } },
        _count: { select: { inspections: true, issues: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/assets/:id
router.get('/assets/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        facility: true,
        zone: true,
        checkpoint: true,
        inspections: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, startedAt: true, inspector: { select: { fullName: true } } },
        },
        issues: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, severity: true, status: true, createdAt: true },
        },
      },
    });

    if (!asset) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } });
      return;
    }

    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/assets
router.post('/assets', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = AssetSchema.parse(req.body);

    const asset = await prisma.asset.create({
      data: {
        facilityId: data.facilityId,
        zoneId: data.zoneId || null,
        checkpointId: data.checkpointId || null,
        name: data.name,
        assetTag: data.assetTag.toUpperCase(),
        category: data.category,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        manufacturer: data.manufacturer || null,
        installationDate: data.installationDate ? new Date(data.installationDate) : null,
        status: data.status,
        criticality: data.criticality,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ASSET_CREATED',
      entityType: 'ASSET',
      entityId: asset.id,
      facilityId: asset.facilityId,
      details: { name: asset.name, assetTag: asset.assetTag },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/assets/:id
router.put('/assets/:id', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = AssetSchema.parse(req.body);

    const updated = await prisma.asset.update({
      where: { id },
      data: {
        name: data.name,
        assetTag: data.assetTag.toUpperCase(),
        category: data.category,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        manufacturer: data.manufacturer || null,
        installationDate: data.installationDate ? new Date(data.installationDate) : null,
        status: data.status,
        criticality: data.criticality,
        zoneId: data.zoneId || null,
        checkpointId: data.checkpointId || null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
