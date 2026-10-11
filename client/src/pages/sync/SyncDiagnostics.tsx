import React, { useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Send,
  Database,
  Layers,
} from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { syncManager } from '../../offline/syncManager';
import { OfflineOutboxOperation, db } from '../../offline/db';
import { syncApi, SyncDiagnosticsData } from '../../api/syncApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';

export const SyncDiagnostics: React.FC = () => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    lastError,
    syncNow,
    simulateOffline,
    setSimulateOffline,
    refreshCounts,
  } = useSync();

  const [outboxItems, setOutboxItems] = useState<OfflineOutboxOperation[]>([]);
  const [serverDiagnostics, setServerDiagnostics] = useState<SyncDiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchOutbox = async () => {
    setLoading(true);
    try {
      const items = await syncManager.getOutbox();
      setOutboxItems(items);

      if (isOnline) {
        const res = await syncApi.getDiagnostics();
        if (res.success && res.data) {
          setServerDiagnostics(res.data);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
  }, [isOnline]);

  const handleManualFlush = async () => {
    await syncNow();
    await fetchOutbox();
  };

  const handleClearCompleted = async () => {
    await syncManager.clearCompleted();
    await fetchOutbox();
  };

  const handleRetryOp = async (opId: string) => {
    await syncManager.retryOperation(opId);
    await fetchOutbox();
  };

  // Test idempotency by replaying test queue operation
  const handleRunReplayTest = async () => {
    setTestResult('Queuing test idempotency operation...');
    const testRecordId = crypto.randomUUID();

    await syncManager.queueOperation({
      entityType: 'INSPECTION',
      action: 'UPDATE',
      recordId: testRecordId,
      baseVersion: 1,
      payload: {
        id: testRecordId,
        testFlag: true,
        summaryNotes: 'Automated Idempotency Replay Test Item',
      },
      clientTimestamp: new Date().toISOString(),
    });

    await fetchOutbox();
    setTestResult('Test operation queued with stable client UUID & idempotency key.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Synchronization Diagnostics & Reliability Outbox
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Idempotent batch protocol, retry backoff metrics, and local IndexedDB outbox observability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleRunReplayTest}
          >
            Queue Replay Test
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
            loading={isSyncing}
            disabled={!isOnline}
            onClick={handleManualFlush}
          >
            Flush Outbox
          </Button>
        </div>
      </div>

      {testResult && (
        <div className="p-3 bg-sage-bg border border-[#D5DDD5] text-sage text-xs font-semibold rounded flex items-center justify-between">
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="text-muted hover:text-charcoal">
            &times;
          </button>
        </div>
      )}

      {/* KPI Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Network State
          </span>
          <div className="mt-2 flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-sm font-bold text-sage">
                <Wifi className="w-4 h-4" /> Online (Connected)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-bold text-crimson">
                <WifiOff className="w-4 h-4" /> Offline Mode
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-warm flex items-center justify-between text-[11px] text-muted">
            <span>Simulated Toggle:</span>
            <button
              onClick={() => setSimulateOffline(!simulateOffline)}
              className="font-bold text-terracotta hover:underline"
            >
              {simulateOffline ? 'Disable Offline' : 'Simulate Offline'}
            </button>
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Local Pending Operations
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold text-charcoal tabular-nums">{pendingCount}</span>
            <span className="text-xs text-muted ml-2">in IndexedDB</span>
          </div>
          <div className="mt-2 pt-2 border-t border-warm text-[11px] text-muted">
            <span>Outbox queue survives refresh</span>
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Server Processed Lifetime
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold text-charcoal tabular-nums">
              {serverDiagnostics?.totalProcessed ?? 0}
            </span>
            <span className="text-xs text-muted ml-2">operations</span>
          </div>
          <div className="mt-2 pt-2 border-t border-warm text-[11px] text-muted">
            <span>Open conflicts: {serverDiagnostics?.openConflictsCount ?? 0}</span>
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Last Successful Sync
          </span>
          <div className="mt-2 text-sm font-bold text-charcoal">
            {lastSyncAt ? lastSyncAt.toLocaleTimeString() : 'Not synced yet'}
          </div>
          <div className="mt-2 pt-2 border-t border-warm text-[11px] text-muted">
            <span>{lastError ? `Notice: ${lastError}` : 'Engine healthy'}</span>
          </div>
        </Card>
      </div>

      {/* Local IndexedDB Outbox Table */}
      <Card
        title="Local Outbox Queue (IndexedDB)"
        subtitle="Operations awaiting or recently processed through idempotent synchronization protocol"
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleClearCompleted}
          >
            Clear Completed
          </Button>
        }
      >
        {outboxItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            The local synchronization outbox queue is currently empty.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">Entity / Action</th>
                  <th className="p-2.5">Idempotency Key</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Retries</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm">
                {outboxItems.map((op) => (
                  <tr key={op.operationId} className="hover:bg-ivory/50">
                    <td className="p-2.5">
                      <span className="font-bold text-charcoal block">
                        {op.entityType} ({op.action})
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        ID: {op.recordId.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-muted max-w-[200px] truncate">
                      {op.idempotencyKey}
                    </td>
                    <td className="p-2.5">
                      <StatusBadge status={op.status} size="sm" />
                      {op.errorMessage && (
                        <p className="text-[10px] text-crimson mt-0.5 line-clamp-1">
                          {op.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="p-2.5 tabular-nums text-muted">
                      {new Date(op.clientTimestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2.5 tabular-nums font-semibold">{op.retryCount}</td>
                    <td className="p-2.5 text-right">
                      {op.status === 'FAILED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRetryOp(op.operationId)}
                        >
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Server Confirmed Operations Record */}
      {serverDiagnostics?.recentOperations && (
        <Card
          title="Recent Server-Acknowledged Sync Records"
          subtitle="Processed via /api/v1/sync with transactional idempotency guarantees"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">Operation ID</th>
                  <th className="p-2.5">Entity</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Processed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm">
                {serverDiagnostics.recentOperations.slice(0, 8).map((rec: any) => (
                  <tr key={rec.id}>
                    <td className="p-2.5 font-mono text-[11px] text-muted">
                      {rec.operationId.substring(0, 12)}...
                    </td>
                    <td className="p-2.5 font-semibold text-charcoal">{rec.entityType}</td>
                    <td className="p-2.5 text-muted">{rec.action}</td>
                    <td className="p-2.5">
                      <StatusBadge status={rec.status} size="sm" />
                    </td>
                    <td className="p-2.5 text-muted tabular-nums">
                      {new Date(rec.processedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
