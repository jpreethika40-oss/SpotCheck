import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';

const router = Router();

router.use(authenticateUser);

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

// GET /api/v1/reports/inspections/csv
router.get('/inspections/csv', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        facility: { select: { name: true, code: true } },
        zone: { select: { name: true } },
        checkpoint: { select: { name: true, code: true } },
        inspector: { select: { fullName: true, email: true } },
        template: { select: { name: true, version: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = [
      'Inspection ID',
      'Facility Code',
      'Facility Name',
      'Zone',
      'Checkpoint Code',
      'Checkpoint Name',
      'Inspector Name',
      'Status',
      'Started At',
      'Completed At',
      'Summary Notes',
      'Weather',
      'Version',
    ];

    const rows = inspections.map((i) => [
      escapeCsv(i.id),
      escapeCsv(i.facility.code),
      escapeCsv(i.facility.name),
      escapeCsv(i.zone?.name || 'N/A'),
      escapeCsv(i.checkpoint?.code || 'N/A'),
      escapeCsv(i.checkpoint?.name || 'N/A'),
      escapeCsv(i.inspector.fullName),
      escapeCsv(i.status),
      escapeCsv(i.startedAt.toISOString()),
      escapeCsv(i.completedAt?.toISOString() || ''),
      escapeCsv(i.summaryNotes || ''),
      escapeCsv(i.weatherCondition || ''),
      escapeCsv(i.version),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'EXPORT_INSPECTIONS_CSV',
      entityType: 'INSPECTION',
      entityId: 'BATCH_EXPORT',
      details: { rowCount: inspections.length },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inspections_export.csv"');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/work-orders/csv
router.get('/work-orders/csv', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { facilityId } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);

    const issues = await prisma.issue.findMany({
      where,
      include: {
        facility: { select: { name: true, code: true } },
        zone: { select: { name: true } },
        checkpoint: { select: { name: true, code: true } },
        asset: { select: { name: true, assetTag: true } },
        reportedBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        verifiedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = [
      'Issue ID',
      'Facility Code',
      'Facility Name',
      'Zone',
      'Checkpoint Code',
      'Asset Tag',
      'Title',
      'Category',
      'Severity',
      'Status',
      'Reported By',
      'Assigned To',
      'Due Date',
      'Resolution Notes',
      'Verified By',
      'Verified At',
      'Created At',
    ];

    const rows = issues.map((iss) => [
      escapeCsv(iss.id),
      escapeCsv(iss.facility.code),
      escapeCsv(iss.facility.name),
      escapeCsv(iss.zone?.name || 'N/A'),
      escapeCsv(iss.checkpoint?.code || 'N/A'),
      escapeCsv(iss.asset?.assetTag || 'N/A'),
      escapeCsv(iss.title),
      escapeCsv(iss.category),
      escapeCsv(iss.severity),
      escapeCsv(iss.status),
      escapeCsv(iss.reportedBy.fullName),
      escapeCsv(iss.assignedTo?.fullName || 'Unassigned'),
      escapeCsv(iss.dueDate?.toISOString() || ''),
      escapeCsv(iss.resolutionNotes || ''),
      escapeCsv(iss.verifiedBy?.fullName || ''),
      escapeCsv(iss.verifiedAt?.toISOString() || ''),
      escapeCsv(iss.createdAt.toISOString()),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    await recordAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'EXPORT_WORK_ORDERS_CSV',
      entityType: 'ISSUE',
      entityId: 'BATCH_EXPORT',
      details: { rowCount: issues.length },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="work_orders_export.csv"');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

export default router;
