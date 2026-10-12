import { Router, Response, NextFunction } from 'express';
import { WorkOrderStatus, IssueSeverity, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { createNotification } from '../services/notificationService';
import { CreateIssueSchema, TransitionWorkOrderSchema, WORK_ORDER_STATE_TRANSITIONS } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/work-orders (List issues & work orders)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId, status, severity, assignedToId, search, isOverdue, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);
    if (status) where.status = status as WorkOrderStatus;
    if (severity) where.severity = severity as IssueSeverity;
    if (assignedToId) where.assignedToId = String(assignedToId);

    // If Technician role, can view assigned work orders or facilities assigned
    if (req.user!.role === UserRole.MAINTENANCE_TECHNICIAN) {
      where.OR = [
        { assignedToId: req.user!.id },
        { facilityId: { in: req.user!.facilityIds } },
      ];
    } else if (req.user!.role === UserRole.INSPECTOR) {
      where.facilityId = { in: req.user!.facilityIds };
    }

    if (isOverdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: [WorkOrderStatus.RESOLVED, WorkOrderStatus.VERIFIED] };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: String(search), mode: 'insensitive' } },
            { description: { contains: String(search), mode: 'insensitive' } },
            { category: { contains: String(search), mode: 'insensitive' } },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit), 10)));

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          facility: { select: { id: true, name: true, code: true } },
          zone: { select: { id: true, name: true, code: true } },
          checkpoint: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, name: true, assetTag: true } },
          reportedBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          verifiedBy: { select: { id: true, fullName: true, email: true } },
          _count: { select: { events: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.issue.count({ where }),
    ]);

    res.json({
      success: true,
      data: issues.map((iss) => ({
        ...iss,
        facilityName: iss.facility.name,
        zoneName: iss.zone?.name,
        checkpointName: iss.checkpoint?.name,
        assetName: iss.asset?.name,
        reportedByName: iss.reportedBy.fullName,
        assignedToName: iss.assignedTo?.fullName,
        verifiedByName: iss.verifiedBy?.fullName,
        eventsCount: iss._count.events,
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

// GET /api/v1/work-orders/:id (Detail with full event timeline)
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        facility: true,
        zone: true,
        checkpoint: true,
        asset: true,
        reportedBy: { select: { id: true, fullName: true, email: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
        verifiedBy: { select: { id: true, fullName: true, email: true, role: true } },
        inspection: { select: { id: true, status: true, startedAt: true } },
        events: {
          include: { actor: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!issue) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        ...issue,
        facilityName: issue.facility.name,
        zoneName: issue.zone?.name,
        checkpointName: issue.checkpoint?.name,
        assetName: issue.asset?.name,
        reportedByName: issue.reportedBy.fullName,
        assignedToName: issue.assignedTo?.fullName,
        verifiedByName: issue.verifiedBy?.fullName,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/work-orders (Manual issue creation)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = CreateIssueSchema.parse(req.body);

    const issue = await prisma.issue.create({
      data: {
        id: data.id || undefined,
        facilityId: data.facilityId,
        zoneId: data.zoneId || null,
        checkpointId: data.checkpointId || null,
        assetId: data.assetId || null,
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        reportedById: req.user!.id,
        status: data.assignedToId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.REPORTED,
        assignedToId: data.assignedToId || null,
        dueDate: data.dueDate && typeof data.dueDate === 'string' && data.dueDate.trim() ? new Date(data.dueDate) : null,
        evidenceAttachmentIds: data.evidenceAttachmentIds || [],
        workAttachmentIds: [],
        version: 1,
      },
      include: { facility: true, reportedBy: true, assignedTo: true },
    });

    await prisma.workOrderEvent.create({
      data: {
        issueId: issue.id,
        actorId: req.user!.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: issue.status,
        notes: 'Initial work order creation.',
      },
    });

    if (data.assignedToId) {
      await createNotification({
        userId: data.assignedToId,
        title: 'Work Order Assigned',
        message: `You were assigned: ${issue.title} (${issue.severity} severity)`,
        type: 'ASSIGNMENT',
        entityType: 'ISSUE',
        entityId: issue.id,
      });
    }

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'WORK_ORDER_CREATED',
      entityType: 'ISSUE',
      entityId: issue.id,
      facilityId: issue.facilityId,
      newVersion: 1,
      details: { title: issue.title, severity: issue.severity },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/work-orders/:id/transition (Server-enforced state machine)
router.post('/:id/transition', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = TransitionWorkOrderSchema.parse(req.body);

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: { facility: true, assignedTo: true },
    });

    if (!issue) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } });
      return;
    }

    // Concurrency check
    if (issue.version !== data.currentVersion) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: `The work order has been modified by another user (server version: ${issue.version}, provided version: ${data.currentVersion}). Please refresh.`,
          serverRecord: issue,
        },
      });
      return;
    }

    const currentStatus = issue.status;
    const targetStatus = data.targetStatus as WorkOrderStatus;

    // Check permitted transitions
    const allowed = WORK_ORDER_STATE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ILLEGAL_TRANSITION',
          message: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Permitted transitions: [${allowed.join(', ')}]`,
        },
      });
      return;
    }

    // Authorization checks for transitions
    // Only Facility Manager can verify and close
    if (targetStatus === WorkOrderStatus.VERIFIED) {
      if (req.user!.role !== UserRole.FACILITY_MANAGER) {
        res.status(403).json({
          success: false,
          error: {
            code: 'VERIFICATION_UNAUTHORIZED',
            message: 'Only Facility Managers are authorized to verify and sign off on completed work orders.',
          },
        });
        return;
      }
      if (!data.verificationNotes || data.verificationNotes.trim().length < 5) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VERIFICATION_NOTES_REQUIRED',
            message: 'Verification notes and sign-off remarks are mandatory when verifying a repair.',
          },
        });
        return;
      }
    }

    // Resolving work requires resolution notes
    if (targetStatus === WorkOrderStatus.RESOLVED) {
      if (!data.resolutionNotes || data.resolutionNotes.trim().length < 5) {
        res.status(400).json({
          success: false,
          error: {
            code: 'RESOLUTION_NOTES_REQUIRED',
            message: 'Detailed resolution notes describing work performed are mandatory when marking an issue resolved.',
          },
        });
        return;
      }
    }

    // If verification was rejected (moving from RESOLVED back to IN_PROGRESS)
    const isRejection = currentStatus === WorkOrderStatus.RESOLVED && targetStatus === WorkOrderStatus.IN_PROGRESS;

    // Execute state update inside transaction
    const [updated, event] = await prisma.$transaction([
      prisma.issue.update({
        where: { id },
        data: {
          status: targetStatus,
          assignedToId: data.assignedToId !== undefined ? data.assignedToId : issue.assignedToId,
          resolutionNotes: data.resolutionNotes || issue.resolutionNotes,
          verificationNotes: data.verificationNotes || issue.verificationNotes,
          verifiedById: targetStatus === WorkOrderStatus.VERIFIED ? req.user!.id : isRejection ? null : issue.verifiedById,
          verifiedAt: targetStatus === WorkOrderStatus.VERIFIED ? new Date() : isRejection ? null : issue.verifiedAt,
          workAttachmentIds: data.workAttachmentIds
            ? Array.from(new Set([...issue.workAttachmentIds, ...data.workAttachmentIds]))
            : issue.workAttachmentIds,
          version: issue.version + 1,
        },
        include: {
          facility: true,
          assignedTo: true,
          reportedBy: true,
          verifiedBy: true,
        },
      }),
      prisma.workOrderEvent.create({
        data: {
          issueId: id,
          actorId: req.user!.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          notes: data.notes || (isRejection ? `Verification rejected: ${data.verificationNotes || 'Work incomplete'}` : data.resolutionNotes || `Moved to ${targetStatus}`),
          evidenceAttachmentIds: data.workAttachmentIds || [],
        },
        include: { actor: { select: { fullName: true, role: true } } },
      }),
    ]);

    // Notifications
    if (isRejection && issue.assignedToId) {
      await createNotification({
        userId: issue.assignedToId,
        title: 'Work Order Verification Rejected',
        message: `Work on "${issue.title}" was not verified and returned to In Progress. Notes: ${data.notes || 'Please review.'}`,
        type: 'STATUS_CHANGE',
        entityType: 'ISSUE',
        entityId: id,
      });
    } else if (targetStatus === WorkOrderStatus.RESOLVED) {
      // Notify managers that work order is awaiting verification
      const managers = await prisma.user.findMany({
        where: { role: UserRole.FACILITY_MANAGER, isActive: true },
      });
      for (const mgr of managers) {
        await createNotification({
          userId: mgr.id,
          title: 'Work Order Awaiting Verification',
          message: `${req.user!.fullName} marked "${issue.title}" as Resolved. Verification sign-off required.`,
          type: 'STATUS_CHANGE',
          entityType: 'ISSUE',
          entityId: id,
        });
      }
    }

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: isRejection ? 'WORK_ORDER_REJECTED' : `WORK_ORDER_${targetStatus}`,
      entityType: 'ISSUE',
      entityId: id,
      facilityId: issue.facilityId,
      previousVersion: issue.version,
      newVersion: updated.version,
      details: { fromStatus: currentStatus, toStatus: targetStatus, notes: data.notes },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        issue: updated,
        event,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/work-orders/:id/comments (Add activity note / progress update)
router.post('/:id/comments', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes, attachmentIds } = req.body;

    if (!notes || notes.trim().length === 0) {
      res.status(400).json({ success: false, error: { code: 'EMPTY_NOTE', message: 'Comment notes cannot be empty.' } });
      return;
    }

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } });
      return;
    }

    const event = await prisma.workOrderEvent.create({
      data: {
        issueId: id,
        actorId: req.user!.id,
        fromStatus: issue.status,
        toStatus: issue.status,
        notes,
        evidenceAttachmentIds: attachmentIds || [],
      },
      include: { actor: { select: { fullName: true, role: true } } },
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

export default router;
