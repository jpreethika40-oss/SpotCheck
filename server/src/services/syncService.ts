import { prisma } from '../db/prisma';
import { AuthenticatedUser } from '../middleware/auth';
import { recordAuditEvent } from './auditService';
import { createNotification } from './notificationService';
import { WorkOrderStatus } from '@prisma/client';
import { WORK_ORDER_STATE_TRANSITIONS, SyncOperation, SyncOperationResult, ConflictDetails } from '@spotcheck/shared';

// Safe independent field definitions
const INDEPENDENT_INSPECTION_FIELDS = ['weatherCondition', 'summaryNotes'];

export async function processSyncBatch(
  operations: SyncOperation[],
  actor: AuthenticatedUser
): Promise<SyncOperationResult[]> {
  const results: SyncOperationResult[] = [];

  // Check user active status at time of sync processing
  const freshUser = await prisma.user.findUnique({
    where: { id: actor.id },
  });

  if (!freshUser || !freshUser.isActive) {
    // Immediate rejection of the entire batch if user revoked
    return operations.map((op) => ({
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: false,
      status: 'REJECTED',
      errorMessage: 'Account permissions have been revoked. Sync operations rejected by server.',
    }));
  }

  // Process operations sequentially inside transactional boundaries for ordering dependencies
  for (const op of operations) {
    try {
      // 1. Idempotency Check
      const existingRecord = await prisma.syncOperationRecord.findUnique({
        where: { idempotencyKey: op.idempotencyKey },
      });

      if (existingRecord) {
        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          success: existingRecord.status === 'APPLIED',
          status: 'ALREADY_PROCESSED',
          serverRecord: existingRecord.resultJson,
        });
        continue;
      }

      // 2. Process based on entity type
      let opResult: SyncOperationResult;

      if (op.entityType === 'INSPECTION') {
        opResult = await processInspectionSync(op, actor);
      } else if (op.entityType === 'ISSUE' || op.entityType === 'WORK_ORDER') {
        opResult = await processWorkOrderSync(op, actor);
      } else {
        opResult = {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          success: false,
          status: 'REJECTED',
          errorMessage: `Unsupported entity type: ${op.entityType}`,
        };
      }

      // 3. Record idempotency log
      await prisma.syncOperationRecord.create({
        data: {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          action: op.action,
          recordId: op.recordId,
          actorId: actor.id,
          clientTimestamp: new Date(op.clientTimestamp),
          status: opResult.status,
          resultJson: opResult.serverRecord || (opResult.conflictDetails ? { conflict: opResult.conflictDetails } : {}),
        },
      });

      results.push(opResult);
    } catch (err: any) {
      results.push({
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        success: false,
        status: 'REJECTED',
        errorMessage: err.message || 'Operation failed during execution',
      });
    }
  }

  return results;
}

async function processInspectionSync(
  op: SyncOperation,
  actor: AuthenticatedUser
): Promise<SyncOperationResult> {
  const { recordId, baseVersion, payload, action } = op;

  const currentServer = await prisma.inspection.findUnique({
    where: { id: recordId },
  });

  // Action: CREATE
  if (action === 'CREATE') {
    if (currentServer) {
      // If already exists, treat as conflict or already processed
      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        success: true,
        status: 'ALREADY_PROCESSED',
        newVersion: currentServer.version,
        serverRecord: currentServer,
      };
    }

    // Create fresh inspection
    const created = await prisma.inspection.create({
      data: {
        id: recordId,
        templateId: payload.templateId,
        templateVersion: payload.templateVersion || 1,
        facilityId: payload.facilityId,
        zoneId: payload.zoneId || null,
        checkpointId: payload.checkpointId || null,
        assetId: payload.assetId || null,
        inspectorId: actor.id,
        status: payload.status || 'DRAFT',
        startedAt: new Date(payload.startedAt || Date.now()),
        completedAt: payload.completedAt ? new Date(payload.completedAt) : null,
        summaryNotes: payload.summaryNotes || null,
        weatherCondition: payload.weatherCondition || null,
        itemsJson: payload.items || [],
        version: 1,
        syncStatus: 'SYNCED',
        idempotencyKey: op.idempotencyKey,
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'INSPECTION_CREATED_OFFLINE_SYNC',
      entityType: 'INSPECTION',
      entityId: created.id,
      facilityId: created.facilityId,
      newVersion: 1,
      details: { itemsCount: payload.items?.length || 0 },
    });

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: true,
      status: 'APPLIED',
      newVersion: 1,
      serverRecord: created,
    };
  }

  // Action: UPDATE or SUBMIT
  if (!currentServer) {
    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: false,
      status: 'REJECTED',
      errorMessage: `Inspection ${recordId} not found on server to update.`,
    };
  }

  // Check version for concurrency
  if (currentServer.version !== baseVersion) {
    // CONCURRENCY CONFLICT DETECTED
    // Evaluate field diffs
    const serverItems = (currentServer.itemsJson as any[]) || [];
    const clientItems = (payload.items as any[]) || [];

    const conflictingFields: string[] = [];
    const autoMergedFields: string[] = [];

    // Check independent scalar fields
    if (payload.summaryNotes && payload.summaryNotes !== currentServer.summaryNotes) {
      if (!currentServer.summaryNotes) {
        autoMergedFields.push('summaryNotes');
      } else {
        conflictingFields.push('summaryNotes');
      }
    }

    if (payload.weatherCondition && payload.weatherCondition !== currentServer.weatherCondition) {
      if (!currentServer.weatherCondition) {
        autoMergedFields.push('weatherCondition');
      } else {
        conflictingFields.push('weatherCondition');
      }
    }

    // Check items diff
    for (const cItem of clientItems) {
      const sItem = serverItems.find((s) => s.fieldId === cItem.fieldId);
      if (sItem) {
        if (JSON.stringify(sItem) !== JSON.stringify(cItem)) {
          conflictingFields.push(`item_${cItem.fieldId}_${cItem.label || cItem.key}`);
        }
      }
    }

    // Record formal conflict in DB
    const conflictRecord = await prisma.conflictRecord.create({
      data: {
        recordId,
        entityType: 'INSPECTION',
        actorId: actor.id,
        baseVersion,
        serverVersion: currentServer.version,
        clientVersion: baseVersion + 1,
        conflictingFields: conflictingFields.length > 0 ? conflictingFields : ['version_mismatch'],
        status: 'OPEN',
        payloadLocal: payload,
        payloadServer: currentServer as any,
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SYNC_CONFLICT_DETECTED',
      entityType: 'INSPECTION',
      entityId: recordId,
      previousVersion: baseVersion,
      newVersion: currentServer.version,
      details: { conflictId: conflictRecord.id, conflictingFields },
    });

    const conflictDetails: ConflictDetails = {
      recordId,
      entityType: 'INSPECTION',
      baseVersion,
      serverVersion: currentServer.version,
      localVersion: baseVersion + 1,
      conflictingFields: conflictingFields.length > 0 ? conflictingFields : ['version_mismatch'],
      autoMergedFields,
      localChanges: payload,
      serverChanges: currentServer,
    };

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: false,
      status: 'CONFLICT',
      conflictDetails,
      errorMessage: `Concurrent edit detected on inspection ${recordId}. Server is at version ${currentServer.version}, base was ${baseVersion}.`,
    };
  }

  // Version matches! Safe optimistic update
  const updated = await prisma.inspection.update({
    where: { id: recordId },
    data: {
      status: payload.status || currentServer.status,
      summaryNotes: payload.summaryNotes ?? currentServer.summaryNotes,
      weatherCondition: payload.weatherCondition ?? currentServer.weatherCondition,
      completedAt: payload.completedAt ? new Date(payload.completedAt) : currentServer.completedAt,
      itemsJson: payload.items || currentServer.itemsJson,
      version: currentServer.version + 1,
      syncStatus: 'SYNCED',
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: (action as string) === 'SUBMIT' ? 'INSPECTION_SUBMITTED' : 'INSPECTION_UPDATED_SYNC',
    entityType: 'INSPECTION',
    entityId: updated.id,
    facilityId: updated.facilityId,
    previousVersion: currentServer.version,
    newVersion: updated.version,
    details: { status: updated.status },
  });

  return {
    operationId: op.operationId,
    idempotencyKey: op.idempotencyKey,
    success: true,
    status: 'APPLIED',
    newVersion: updated.version,
    serverRecord: updated,
  };
}

async function processWorkOrderSync(
  op: SyncOperation,
  actor: AuthenticatedUser
): Promise<SyncOperationResult> {
  const { recordId, baseVersion, payload, action } = op;

  const currentIssue = await prisma.issue.findUnique({
    where: { id: recordId },
  });

  if (action === 'CREATE') {
    if (currentIssue) {
      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        success: true,
        status: 'ALREADY_PROCESSED',
        newVersion: currentIssue.version,
        serverRecord: currentIssue,
      };
    }

    const created = await prisma.issue.create({
      data: {
        id: recordId,
        facilityId: payload.facilityId,
        zoneId: payload.zoneId || null,
        checkpointId: payload.checkpointId || null,
        assetId: payload.assetId || null,
        inspectionId: payload.inspectionId || null,
        title: payload.title,
        description: payload.description,
        category: payload.category || 'GENERAL',
        severity: payload.severity || 'MEDIUM',
        reportedById: actor.id,
        status: WorkOrderStatus.REPORTED,
        assignedToId: payload.assignedToId || null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        evidenceAttachmentIds: payload.evidenceAttachmentIds || [],
        workAttachmentIds: [],
        version: 1,
      },
    });

    await prisma.workOrderEvent.create({
      data: {
        issueId: created.id,
        actorId: actor.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.REPORTED,
        notes: 'Work order created during offline inspection sync.',
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ISSUE_CREATED_SYNC',
      entityType: 'ISSUE',
      entityId: created.id,
      facilityId: created.facilityId,
      newVersion: 1,
      details: { title: created.title, severity: created.severity },
    });

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: true,
      status: 'APPLIED',
      newVersion: 1,
      serverRecord: created,
    };
  }

  // Update / State Transition
  if (!currentIssue) {
    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: false,
      status: 'REJECTED',
      errorMessage: `Work order ${recordId} not found on server.`,
    };
  }

  // Concurrency check
  if (currentIssue.version !== baseVersion) {
    const conflictRecord = await prisma.conflictRecord.create({
      data: {
        recordId,
        entityType: 'WORK_ORDER',
        actorId: actor.id,
        baseVersion,
        serverVersion: currentIssue.version,
        clientVersion: baseVersion + 1,
        conflictingFields: ['status', 'version_mismatch'],
        status: 'OPEN',
        payloadLocal: payload,
        payloadServer: currentIssue as any,
      },
    });

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: false,
      status: 'CONFLICT',
      conflictDetails: {
        recordId,
        entityType: 'WORK_ORDER',
        baseVersion,
        serverVersion: currentIssue.version,
        localVersion: baseVersion + 1,
        conflictingFields: ['status'],
        autoMergedFields: [],
        localChanges: payload,
        serverChanges: currentIssue,
      },
      errorMessage: `Work order state was modified on server (v${currentIssue.version}) while client held v${baseVersion}.`,
    };
  }

  // State Machine Validation
  if (payload.targetStatus) {
    const targetStatus = payload.targetStatus as WorkOrderStatus;
    const allowed = WORK_ORDER_STATE_TRANSITIONS[currentIssue.status] || [];

    if (!allowed.includes(targetStatus)) {
      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        success: false,
        status: 'REJECTED',
        errorMessage: `Illegal status transition: cannot move from ${currentIssue.status} to ${targetStatus}.`,
      };
    }

    // Role verification for state transitions
    if (targetStatus === WorkOrderStatus.VERIFIED && actor.role !== 'FACILITY_MANAGER') {
      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        success: false,
        status: 'REJECTED',
        errorMessage: 'Only Facility Managers are authorized to verify and close work orders.',
      };
    }

    const updated = await prisma.issue.update({
      where: { id: recordId },
      data: {
        status: targetStatus,
        assignedToId: payload.assignedToId !== undefined ? payload.assignedToId : currentIssue.assignedToId,
        resolutionNotes: payload.resolutionNotes || currentIssue.resolutionNotes,
        verificationNotes: payload.verificationNotes || currentIssue.verificationNotes,
        verifiedById: targetStatus === WorkOrderStatus.VERIFIED ? actor.id : currentIssue.verifiedById,
        verifiedAt: targetStatus === WorkOrderStatus.VERIFIED ? new Date() : currentIssue.verifiedAt,
        workAttachmentIds: payload.workAttachmentIds || currentIssue.workAttachmentIds,
        version: currentIssue.version + 1,
      },
    });

    await prisma.workOrderEvent.create({
      data: {
        issueId: updated.id,
        actorId: actor.id,
        fromStatus: currentIssue.status,
        toStatus: targetStatus,
        notes: payload.notes || payload.resolutionNotes || payload.verificationNotes || 'Status updated via sync',
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'WORK_ORDER_TRANSITION_SYNC',
      entityType: 'ISSUE',
      entityId: updated.id,
      facilityId: updated.facilityId,
      previousVersion: currentIssue.version,
      newVersion: updated.version,
      details: { fromStatus: currentIssue.status, toStatus: targetStatus },
    });

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      success: true,
      status: 'APPLIED',
      newVersion: updated.version,
      serverRecord: updated,
    };
  }

  // Generic update without status change
  const updated = await prisma.issue.update({
    where: { id: recordId },
    data: {
      description: payload.description || currentIssue.description,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : currentIssue.dueDate,
      version: currentIssue.version + 1,
    },
  });

  return {
    operationId: op.operationId,
    idempotencyKey: op.idempotencyKey,
    success: true,
    status: 'APPLIED',
    newVersion: updated.version,
    serverRecord: updated,
  };
}
