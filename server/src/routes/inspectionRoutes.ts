import { Router, Response, NextFunction } from 'express';
import { InspectionStatus, IssueSeverity, WorkOrderStatus, SyncStatus, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { createNotification } from '../services/notificationService';
import { generateInspectionPdf } from '../services/pdfService';
import { SubmitInspectionSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/inspections
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId, status, inspectorId, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);
    if (status) where.status = status as InspectionStatus;
    if (inspectorId) where.inspectorId = String(inspectorId);

    // If Inspector role, only allow assigned facilities
    if (req.user!.role === UserRole.INSPECTOR) {
      where.facilityId = { in: req.user!.facilityIds };
    }

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit), 10)));

    const [inspections, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        include: {
          facility: { select: { id: true, name: true, code: true } },
          zone: { select: { id: true, name: true, code: true } },
          checkpoint: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, name: true, assetTag: true } },
          inspector: { select: { id: true, fullName: true, email: true } },
          template: { select: { id: true, name: true, version: true } },
          _count: { select: { issues: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inspection.count({ where }),
    ]);

    res.json({
      success: true,
      data: inspections.map((i) => ({
        id: i.id,
        templateId: i.templateId,
        templateName: i.template.name,
        templateVersion: i.templateVersion,
        facilityId: i.facilityId,
        facilityName: i.facility.name,
        zoneId: i.zoneId,
        zoneName: i.zone?.name,
        checkpointId: i.checkpointId,
        checkpointName: i.checkpoint?.name,
        assetId: i.assetId,
        assetName: i.asset?.name,
        inspectorId: i.inspectorId,
        inspectorName: i.inspector.fullName,
        status: i.status,
        startedAt: i.startedAt,
        completedAt: i.completedAt,
        summaryNotes: i.summaryNotes,
        weatherCondition: i.weatherCondition,
        itemsCount: (i.itemsJson as any[])?.length || 0,
        issuesCount: i._count.issues,
        version: i.version,
        syncStatus: i.syncStatus,
        createdAt: i.createdAt,
      })),
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

// GET /api/v1/inspections/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        facility: true,
        zone: true,
        checkpoint: true,
        asset: true,
        inspector: { select: { id: true, fullName: true, email: true } },
        template: true,
        issues: {
          include: { assignedTo: { select: { fullName: true } } },
        },
      },
    });

    if (!inspection) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection record not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        ...inspection,
        items: inspection.itemsJson as any[],
        facilityName: inspection.facility.name,
        zoneName: inspection.zone?.name,
        checkpointName: inspection.checkpoint?.name,
        assetName: inspection.asset?.name,
        inspectorName: inspection.inspector.fullName,
        templateName: inspection.template.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inspections (Create draft or start inspection)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = SubmitInspectionSchema.parse(req.body);

    const inspection = await prisma.inspection.create({
      data: {
        id: data.id || undefined,
        templateId: data.templateId,
        templateVersion: 1,
        facilityId: data.facilityId,
        zoneId: data.zoneId || null,
        checkpointId: data.checkpointId || null,
        assetId: data.assetId || null,
        inspectorId: req.user!.id,
        status: (data.status as InspectionStatus) || InspectionStatus.SUBMITTED,
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
        summaryNotes: data.summaryNotes || null,
        weatherCondition: data.weatherCondition || null,
        itemsJson: data.items || [],
        version: 1,
        syncStatus: SyncStatus.SYNCED,
        idempotencyKey: data.idempotencyKey || undefined,
      },
      include: { facility: true, inspector: true },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'INSPECTION_CREATED',
      entityType: 'INSPECTION',
      entityId: inspection.id,
      facilityId: inspection.facilityId,
      newVersion: 1,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: inspection });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/inspections/:id (Update draft in progress)
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = SubmitInspectionSchema.parse(req.body);

    const existing = await prisma.inspection.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection not found' } });
      return;
    }

    if (existing.status === InspectionStatus.SUBMITTED || existing.status === InspectionStatus.VERIFIED) {
      res.status(400).json({
        success: false,
        error: { code: 'IMMUTABLE_INSPECTION', message: 'Already submitted inspections cannot be edited directly.' },
      });
      return;
    }

    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        summaryNotes: data.summaryNotes ?? existing.summaryNotes,
        weatherCondition: data.weatherCondition ?? existing.weatherCondition,
        itemsJson: data.items,
        version: existing.version + 1,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inspections/:id/submit (Official submission with automated issue creation on failed checkpoints)
router.post('/:id/submit', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.inspection.findUnique({
      where: { id },
      include: { template: true, facility: true, checkpoint: true, asset: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection not found' } });
      return;
    }

    const items = body.items || (existing.itemsJson as any[]) || [];
    const templateFields = (existing.template.fieldsJson as any[]) || [];

    // Validate required fields & required photo evidence on failure
    for (const f of templateFields) {
      const resp = items.find((it: any) => it.fieldId === f.id);
      if (f.required && !resp) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: `Required checklist item missing: "${f.label}"`,
          },
        });
        return;
      }

      // Check required evidence on failure
      if (f.requireEvidenceOnFailure && resp && resp.result === 'FAIL') {
        const attachments = resp.attachmentIds || [];
        if (attachments.length === 0) {
          res.status(400).json({
            success: false,
            error: {
              code: 'EVIDENCE_REQUIRED',
              message: `Photo evidence is mandatory when failing checkpoint: "${f.label}"`,
            },
          });
          return;
        }
      }
    }

    // Process failed items and automatically spawn issues according to template rules!
    const createdIssues: any[] = [];
    for (const item of items) {
      const fieldDef = templateFields.find((f: any) => f.id === item.fieldId);
      const isFailed = item.result === 'FAIL' || item.isFlaggedDefect;

      if (isFailed && fieldDef && fieldDef.isCriticalFailure) {
        const severity = (fieldDef.failureDefectSeverity as IssueSeverity) || IssueSeverity.HIGH;
        const category = fieldDef.failureDefectCategory || 'FACILITY_DEFECT';

        const issue = await prisma.issue.create({
          data: {
            facilityId: existing.facilityId,
            zoneId: existing.zoneId,
            checkpointId: existing.checkpointId,
            assetId: existing.assetId,
            inspectionId: existing.id,
            title: `Defect: ${fieldDef.label}`,
            description: item.failedReason || item.notes || `Failed critical checkpoint item: ${fieldDef.label}`,
            category,
            severity,
            reportedById: req.user!.id,
            status: WorkOrderStatus.REPORTED,
            evidenceAttachmentIds: item.attachmentIds || [],
            workAttachmentIds: [],
            version: 1,
          },
        });

        await prisma.workOrderEvent.create({
          data: {
            issueId: issue.id,
            actorId: req.user!.id,
            fromStatus: WorkOrderStatus.REPORTED,
            toStatus: WorkOrderStatus.REPORTED,
            notes: `Auto-generated from failed checkpoint during inspection submission.`,
          },
        });

        createdIssues.push(issue);
      }
    }

    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        status: InspectionStatus.SUBMITTED,
        completedAt: new Date(),
        summaryNotes: body.summaryNotes ?? existing.summaryNotes,
        weatherCondition: body.weatherCondition ?? existing.weatherCondition,
        itemsJson: items,
        version: existing.version + 1,
      },
    });

    // Notify managers
    const managers = await prisma.user.findMany({
      where: { role: UserRole.FACILITY_MANAGER, isActive: true },
    });

    for (const mgr of managers) {
      await createNotification({
        userId: mgr.id,
        title: 'Inspection Submitted',
        message: `${req.user!.fullName} submitted inspection for ${existing.facility.name}${createdIssues.length > 0 ? ` with ${createdIssues.length} automated issue(s) flagged.` : '.'}`,
        type: 'INSPECTION_SUBMITTED',
        entityType: 'INSPECTION',
        entityId: updated.id,
      });
    }

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'INSPECTION_SUBMITTED',
      entityType: 'INSPECTION',
      entityId: updated.id,
      facilityId: existing.facilityId,
      previousVersion: existing.version,
      newVersion: updated.version,
      details: { automatedIssuesCount: createdIssues.length },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        inspection: updated,
        createdIssues,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inspections/:id/pdf (Export inspection as formatted PDF)
router.get('/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        facility: true,
        zone: true,
        checkpoint: true,
        asset: true,
        inspector: true,
      },
    });

    if (!inspection) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection not found' } });
      return;
    }

    generateInspectionPdf(
      {
        inspectionId: inspection.id,
        facilityName: inspection.facility.name,
        facilityAddress: inspection.facility.address,
        zoneName: inspection.zone?.name,
        checkpointName: inspection.checkpoint?.name,
        assetName: inspection.asset?.name,
        inspectorName: inspection.inspector.fullName,
        status: inspection.status,
        startedAt: inspection.startedAt.toISOString(),
        completedAt: inspection.completedAt?.toISOString(),
        summaryNotes: inspection.summaryNotes || undefined,
        items: (inspection.itemsJson as any[]) || [],
      },
      res
    );
  } catch (err) {
    next(err);
  }
});

export default router;
