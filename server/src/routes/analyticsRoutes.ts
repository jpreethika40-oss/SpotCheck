import { Router, Response, NextFunction } from 'express';
import { InspectionStatus, WorkOrderStatus, IssueSeverity, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

// GET /api/v1/analytics/dashboard (Real database aggregation metrics)
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.query;

    const facilityFilter: any = {};
    if (facilityId) {
      facilityFilter.facilityId = String(facilityId);
    } else if (req.user!.role !== UserRole.FACILITY_MANAGER) {
      facilityFilter.facilityId = { in: req.user!.facilityIds };
    }

    const now = new Date();

    // 1. Inspections Metrics
    const [
      totalInspections,
      completedInspections,
      draftInspections,
      overdueSchedules,
      totalIssues,
      openIssues,
      criticalIssues,
      overdueIssues,
      verifiedIssues,
    ] = await Promise.all([
      prisma.inspection.count({ where: facilityFilter }),
      prisma.inspection.count({
        where: { ...facilityFilter, status: { in: [InspectionStatus.SUBMITTED, InspectionStatus.VERIFIED] } },
      }),
      prisma.inspection.count({
        where: { ...facilityFilter, status: { in: [InspectionStatus.DRAFT, InspectionStatus.IN_PROGRESS] } },
      }),
      prisma.inspectionSchedule.count({
        where: {
          ...(facilityFilter.facilityId ? { facilityId: facilityFilter.facilityId } : {}),
          isActive: true,
          nextDueDate: { lt: now },
        },
      }),
      prisma.issue.count({ where: facilityFilter }),
      prisma.issue.count({
        where: {
          ...facilityFilter,
          status: { in: [WorkOrderStatus.REPORTED, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS] },
        },
      }),
      prisma.issue.count({
        where: {
          ...facilityFilter,
          severity: IssueSeverity.CRITICAL,
          status: { not: WorkOrderStatus.VERIFIED },
        },
      }),
      prisma.issue.count({
        where: {
          ...facilityFilter,
          dueDate: { lt: now },
          status: { notIn: [WorkOrderStatus.RESOLVED, WorkOrderStatus.VERIFIED] },
        },
      }),
      prisma.issue.count({
        where: {
          ...facilityFilter,
          status: WorkOrderStatus.VERIFIED,
        },
      }),
    ]);

    // 2. Issue distribution by Category
    const categoryGroup = await prisma.issue.groupBy({
      by: ['category'],
      where: facilityFilter,
      _count: { category: true },
    });

    const issuesByCategory = categoryGroup.map((c) => ({
      name: c.category,
      count: c._count.category,
    }));

    // 3. Issue distribution by Severity
    const severityGroup = await prisma.issue.groupBy({
      by: ['severity'],
      where: facilityFilter,
      _count: { severity: true },
    });

    const issuesBySeverity = severityGroup.map((s) => ({
      severity: s.severity,
      count: s._count.severity,
    }));

    // 4. Issue distribution by Status
    const statusGroup = await prisma.issue.groupBy({
      by: ['status'],
      where: facilityFilter,
      _count: { status: true },
    });

    const issuesByStatus = statusGroup.map((s) => ({
      status: s.status,
      count: s._count.status,
    }));

    // 5. Checkpoints with repeated failures (Defects count grouped by checkpoint)
    const repeatedFailures = await prisma.issue.groupBy({
      by: ['checkpointId'],
      where: {
        ...facilityFilter,
        checkpointId: { not: null },
      },
      _count: { checkpointId: true },
      orderBy: { _count: { checkpointId: 'desc' } },
      take: 5,
    });

    const checkpointIds = repeatedFailures
      .map((r) => r.checkpointId)
      .filter((id): id is string => id !== null);

    const checkpoints = await prisma.checkpoint.findMany({
      where: { id: { in: checkpointIds } },
      select: { id: true, name: true, code: true },
    });

    const repeatCheckpoints = repeatedFailures.map((rf) => {
      const chk = checkpoints.find((c) => c.id === rf.checkpointId);
      return {
        checkpointId: rf.checkpointId,
        checkpointName: chk?.name || 'Unassigned Area',
        checkpointCode: chk?.code || 'N/A',
        failureCount: rf._count.checkpointId,
      };
    });

    // 6. Recent Activity (Recent inspections and work order events)
    const recentInspections = await prisma.inspection.findMany({
      where: facilityFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        facility: { select: { name: true } },
        inspector: { select: { fullName: true } },
      },
    });

    const recentWorkOrders = await prisma.issue.findMany({
      where: facilityFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        createdAt: true,
        facility: { select: { name: true } },
      },
    });

    // 7. Average resolution time (hours)
    const verifiedIssuesList = await prisma.issue.findMany({
      where: {
        ...facilityFilter,
        status: WorkOrderStatus.VERIFIED,
        verifiedAt: { not: null },
      },
      select: { createdAt: true, verifiedAt: true },
    });

    let avgResolutionHours = 0;
    if (verifiedIssuesList.length > 0) {
      const totalHours = verifiedIssuesList.reduce((acc, iss) => {
        const diffMs = (iss.verifiedAt?.getTime() || 0) - iss.createdAt.getTime();
        return acc + diffMs / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round((totalHours / verifiedIssuesList.length) * 10) / 10;
    }

    const completionRate =
      totalInspections > 0 ? Math.round((completedInspections / totalInspections) * 100) : 0;

    res.json({
      success: true,
      data: {
        metrics: {
          totalInspections,
          completedInspections,
          draftInspections,
          completionRate,
          overdueSchedules,
          totalIssues,
          openIssues,
          criticalIssues,
          overdueIssues,
          verifiedIssues,
          avgResolutionHours,
        },
        issuesByCategory,
        issuesBySeverity,
        issuesByStatus,
        repeatCheckpoints,
        recentInspections,
        recentWorkOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
