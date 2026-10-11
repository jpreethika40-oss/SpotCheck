import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { InspectionTemplateSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/templates
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityType, onlyLatest = 'true', isActive } = req.query;

    const where: any = {};
    if (facilityType) where.facilityType = facilityType;
    if (onlyLatest === 'true') where.isLatest = true;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const templates = await prisma.inspectionTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        facilityType: t.facilityType,
        version: t.version,
        isLatest: t.isLatest,
        isActive: t.isActive,
        fields: t.fieldsJson as any,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/templates/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.inspectionTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection template not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        facilityType: template.facilityType,
        version: template.version,
        isLatest: template.isLatest,
        isActive: template.isActive,
        fields: template.fieldsJson as any,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates (Manager only)
router.post('/', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = InspectionTemplateSchema.parse(req.body);

    const template = await prisma.inspectionTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        facilityType: data.facilityType,
        version: 1,
        isLatest: true,
        isActive: data.isActive,
        fieldsJson: data.fields,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'TEMPLATE_CREATED',
      entityType: 'INSPECTION_TEMPLATE',
      entityId: template.id,
      details: { name: template.name, version: 1, fieldsCount: data.fields.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        ...template,
        fields: template.fieldsJson as any,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/templates/:id (Manager only - supports automatic version bump if inspections exist)
router.put('/:id', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = InspectionTemplateSchema.parse(req.body);

    const existing = await prisma.inspectionTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { inspections: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    // If existing template already has inspections, create a new version to protect historical records!
    if (existing._count.inspections > 0) {
      // Mark current as not latest
      await prisma.inspectionTemplate.update({
        where: { id: existing.id },
        data: { isLatest: false },
      });

      // Create new version
      const newVersion = await prisma.inspectionTemplate.create({
        data: {
          name: data.name,
          description: data.description,
          facilityType: data.facilityType,
          version: existing.version + 1,
          isLatest: true,
          isActive: data.isActive,
          fieldsJson: data.fields,
        },
      });

      await recordAuditEvent({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'TEMPLATE_VERSION_BUMPED',
        entityType: 'INSPECTION_TEMPLATE',
        entityId: newVersion.id,
        previousVersion: existing.version,
        newVersion: newVersion.version,
        details: { name: newVersion.name, reason: 'Historical inspections protected' },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: { ...newVersion, fields: newVersion.fieldsJson as any },
      });
      return;
    }

    // No inspections linked: direct update in place
    const updated = await prisma.inspectionTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        facilityType: data.facilityType,
        fieldsJson: data.fields,
        isActive: data.isActive,
      },
    });

    res.json({
      success: true,
      data: { ...updated, fields: updated.fieldsJson as any },
    });
  } catch (err) {
    next(err);
  }
});

// --- SCHEDULES ---

// GET /api/v1/templates/schedules/all
router.get('/schedules/all', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);

    const schedules = await prisma.inspectionSchedule.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, code: true } },
        template: { select: { id: true, name: true, version: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    });

    res.json({ success: true, data: schedules });
  } catch (err) {
    next(err);
  }
});

export default router;
