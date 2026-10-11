import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export interface AuditParams {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  facilityId?: string;
  previousVersion?: number;
  newVersion?: number;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function recordAuditEvent(params: AuditParams) {
  try {
    const entry = await prisma.auditEvent.create({
      data: {
        actorId: params.actorId || undefined,
        actorEmail: params.actorEmail || undefined,
        actorRole: params.actorRole || undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        facilityId: params.facilityId || undefined,
        previousVersion: params.previousVersion ?? undefined,
        newVersion: params.newVersion ?? undefined,
        details: params.details || {},
        ipAddress: params.ipAddress || undefined,
      },
    });

    logger.info(`Audit logged: ${params.action} on ${params.entityType}:${params.entityId}`, {
      actorId: params.actorId,
      action: params.action,
    });

    return entry;
  } catch (err: any) {
    logger.error('Failed to create audit event', { error: err.message, params });
    // Audit failures should not crash primary operations, but must be logged
    return null;
  }
}
