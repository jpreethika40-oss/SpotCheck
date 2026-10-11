import { db, OfflineOutboxOperation, OfflineInspection, OfflineIssue } from './db';
import { api } from '../api/client';

export type SyncListener = (status: {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}) => void;

class SyncManager {
  private isSyncing = false;
  private lastSyncAt: Date | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('App came online. Triggering synchronization outbox...');
        this.processOutbox();
      });

      // Periodic check every 45 seconds when online
      this.autoSyncInterval = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.processOutbox();
        }
      }, 45000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const pendingCount = await this.getPendingCount();
    const state = {
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
    };
    this.listeners.forEach((l) => l(state));
  }

  public async getPendingCount(): Promise<number> {
    try {
      return await db.offlineOutbox
        .where('status')
        .anyOf(['QUEUED', 'IN_FLIGHT', 'FAILED'])
        .count();
    } catch {
      return 0;
    }
  }

  public async getOutbox(): Promise<OfflineOutboxOperation[]> {
    try {
      return await db.offlineOutbox.orderBy('clientTimestamp').reverse().toArray();
    } catch {
      return [];
    }
  }

  public async queueOperation(
    op: Omit<OfflineOutboxOperation, 'operationId' | 'idempotencyKey' | 'status' | 'retryCount'>
  ): Promise<OfflineOutboxOperation> {
    const operationId = crypto.randomUUID();
    const idempotencyKey = `idemp_${op.entityType}_${op.recordId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const outboxOp: OfflineOutboxOperation = {
      ...op,
      operationId,
      idempotencyKey,
      status: 'QUEUED',
      retryCount: 0,
      clientTimestamp: op.clientTimestamp || new Date().toISOString(),
    };

    await db.offlineOutbox.put(outboxOp);
    this.notify();

    // If online, immediately attempt to flush
    if (navigator.onLine) {
      setTimeout(() => this.processOutbox(), 100);
    }

    return outboxOp;
  }

  public async retryOperation(operationId: string): Promise<void> {
    const op = await db.offlineOutbox.get(operationId);
    if (op) {
      op.status = 'QUEUED';
      op.retryCount = 0;
      op.errorMessage = undefined;
      await db.offlineOutbox.put(op);
      this.notify();
      this.processOutbox();
    }
  }

  public async clearCompleted(): Promise<void> {
    await db.offlineOutbox.where('status').equals('COMPLETED').delete();
    this.notify();
  }

  public async processOutbox(): Promise<{
    processed: number;
    applied: number;
    conflicts: number;
    rejected: number;
    failed: number;
  }> {
    if (this.isSyncing) {
      return { processed: 0, applied: 0, conflicts: 0, rejected: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      this.lastError = 'Device is currently offline.';
      this.notify();
      return { processed: 0, applied: 0, conflicts: 0, rejected: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    let processed = 0;
    let applied = 0;
    let conflicts = 0;
    let rejected = 0;
    let failed = 0;

    try {
      const pendingOps = await db.offlineOutbox
        .where('status')
        .anyOf(['QUEUED', 'FAILED'])
        .sortBy('clientTimestamp');

      if (pendingOps.length === 0) {
        this.isSyncing = false;
        this.lastSyncAt = new Date();
        this.notify();
        return { processed, applied, conflicts, rejected, failed };
      }

      // Mark in-flight
      for (const op of pendingOps) {
        op.status = 'IN_FLIGHT';
        op.lastAttemptAt = new Date().toISOString();
        await db.offlineOutbox.put(op);
      }

      // Format payload for backend POST /api/v1/sync
      const syncPayload = {
        operations: pendingOps.map((op) => ({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          action: op.action,
          recordId: op.recordId,
          baseVersion: op.baseVersion,
          payload: op.payload,
          clientTimestamp: op.clientTimestamp,
        })),
      };

      const res = await api.post('/sync', syncPayload);

      if (!res.success) {
        // Entire batch failed (network error, auth error, etc.)
        for (const op of pendingOps) {
          op.status = 'FAILED';
          op.retryCount += 1;
          op.errorMessage = res.error?.message || 'Sync network request failed';
          await db.offlineOutbox.put(op);
          failed++;
        }
        this.lastError = res.error?.message || 'Synchronization failed';
      } else {
        const results = res.data?.results || [];
        for (const result of results) {
          processed++;
          const op = pendingOps.find((o) => o.operationId === result.operationId);
          if (!op) continue;

          if (result.status === 'APPLIED' || result.status === 'ALREADY_PROCESSED') {
            op.status = 'COMPLETED';
            applied++;

            // Update local DB record sync status
            if (op.entityType === 'INSPECTION') {
              const localInsp = await db.offlineInspections.get(op.recordId);
              if (localInsp) {
                localInsp.syncStatus = 'SYNCED';
                if (result.newVersion) localInsp.version = result.newVersion;
                await db.offlineInspections.put(localInsp);
              }
            } else if (op.entityType === 'ISSUE') {
              const localIssue = await db.offlineIssues.get(op.recordId);
              if (localIssue) {
                localIssue.syncStatus = 'SYNCED';
                if (result.newVersion) localIssue.version = result.newVersion;
                await db.offlineIssues.put(localIssue);
              }
            }
          } else if (result.status === 'CONFLICT') {
            op.status = 'CONFLICT';
            op.errorMessage = 'Concurrent modification detected. Base version is stale.';
            conflicts++;

            if (op.entityType === 'INSPECTION') {
              const localInsp = await db.offlineInspections.get(op.recordId);
              if (localInsp) {
                localInsp.syncStatus = 'CONFLICT';
                await db.offlineInspections.put(localInsp);
              }
            } else if (op.entityType === 'ISSUE') {
              const localIssue = await db.offlineIssues.get(op.recordId);
              if (localIssue) {
                localIssue.syncStatus = 'CONFLICT';
                await db.offlineIssues.put(localIssue);
              }
            }
          } else if (result.status === 'REJECTED') {
            op.status = 'REJECTED';
            op.errorMessage = result.errorMessage || 'Operation rejected by server policy.';
            rejected++;
          } else {
            op.status = 'FAILED';
            op.retryCount += 1;
            op.errorMessage = result.errorMessage || 'Unknown sync error';
            failed++;
          }

          await db.offlineOutbox.put(op);
        }
        this.lastSyncAt = new Date();
      }
    } catch (err: any) {
      this.lastError = err.message || 'Unexpected sync error';
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return { processed, applied, conflicts, rejected, failed };
  }
}

export const syncManager = new SyncManager();
