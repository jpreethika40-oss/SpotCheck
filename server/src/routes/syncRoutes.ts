import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, requireRoles, AuthRequest } from '../middleware/auth';
import { processSyncBatch } from '../services/syncService';
import { recordAuditEvent } from '../services/auditService';
import { SyncBatchSchema, ConflictResolveSchema } from '@spotcheck/shared';

const router = Router();

router.use(authenticateUser);

// POST /api/v1/sync (Batch synchronization outbox processor)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { operations } = SyncBatchSchema.parse(req.body);

    const results = await processSyncBatch(operations as any, req.user!);

    res.json({
      success: true,
      data: {
        totalReceived: operations.length,
        processed: results.length,
        applied: results.filter((r) => r.status === 'APPLIED').length,
        conflicts: results.filter((r) => r.status === 'CONFLICT').length,
        rejected: results.filter((r) => r.status === 'REJECTED').length,
        alreadyProcessed: results.filter((r) => r.status === 'ALREADY_PROCESSED').length,
        results,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sync/diagnostics (Sync diagnostics & health summary)
router.get('/diagnostics', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [recentOps, totalProcessed, conflictCount] = await Promise.all([
      prisma.syncOperationRecord.findMany({
        take: 30,
        orderBy: { processedAt: 'desc' },
      }),
      prisma.syncOperationRecord.count(),
      prisma.conflictRecord.count({ where: { status: 'OPEN' } }),
    ]);

    const statusCounts = await prisma.syncOperationRecord.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusSummary = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.status;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        totalProcessed,
        openConflictsCount: conflictCount,
        statusSummary,
        recentOperations: recentOps,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conflicts (List sync conflicts)
router.get('/conflicts', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status = 'OPEN' } = req.query;

    const conflicts = await prisma.conflictRecord.findMany({
      where: status !== 'ALL' ? { status: String(status) } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: conflicts });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/conflicts/:id/resolve (Resolve conflict explicitly)
router.post('/conflicts/:id/resolve', requireRoles(UserRole.FACILITY_MANAGER), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const body = ConflictResolveSchema.parse({ ...req.body, conflictId: id });

    const conflict = await prisma.conflictRecord.findUnique({
      where: { id },
    });

    if (!conflict) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conflict record not found' } });
      return;
    }

    if (conflict.status === 'RESOLVED') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_RESOLVED', message: 'Conflict is already resolved.' } });
      return;
    }

    // Apply resolution according to strategy
    if (conflict.entityType === 'INSPECTION') {
      const inspection = await prisma.inspection.findUnique({ where: { id: conflict.recordId } });
      if (!inspection) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Target inspection record not found' } });
        return;
      }

      await prisma.inspection.update({
        where: { id: conflict.recordId },
        data: {
          summaryNotes: body.resolvedPayload.summaryNotes ?? inspection.summaryNotes,
          weatherCondition: body.resolvedPayload.weatherCondition ?? inspection.weatherCondition,
          itemsJson: body.resolvedPayload.items ?? inspection.itemsJson,
          version: inspection.version + 1,
          syncStatus: 'SYNCED',
        },
      });
    } else if (conflict.entityType === 'WORK_ORDER' || conflict.entityType === 'ISSUE') {
      const issue = await prisma.issue.findUnique({ where: { id: conflict.recordId } });
      if (!issue) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Target work order record not found' } });
        return;
      }

      await prisma.issue.update({
        where: { id: conflict.recordId },
        data: {
          status: body.resolvedPayload.status || issue.status,
          description: body.resolvedPayload.description || issue.description,
          resolutionNotes: body.resolvedPayload.resolutionNotes || issue.resolutionNotes,
          version: issue.version + 1,
        },
      });
    }

    // Mark conflict resolved
    const resolvedConflict = await prisma.conflictRecord.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedStrategy: body.resolutionStrategy,
        resolvedById: req.user!.id,
        resolvedAt: new Date(),
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CONFLICT_RESOLVED',
      entityType: conflict.entityType,
      entityId: conflict.recordId,
      details: {
        conflictId: id,
        strategy: body.resolutionStrategy,
        fieldsReconciled: conflict.conflictingFields,
      },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: resolvedConflict });
  } catch (err) {
    next(err);
  }
});

export default router;
