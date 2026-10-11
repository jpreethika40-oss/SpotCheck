import React, { useEffect, useState } from 'react';
import { History, Search, Shield, Eye, Clock, Filter } from 'lucide-react';
import { auditApi } from '../../api/auditApi';
import { AuditLogEntry } from '@spotcheck/shared';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';

export const AuditHistory: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getAuditLogs({
        entityType: entityFilter || undefined,
      });
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Security & Operational Audit History
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Immutable system event log recording state changes, access verification, and conflict resolutions
          </p>
        </div>
      </div>

      <Card padding="sm">
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Entity Types</option>
              <option value="INSPECTION">Inspections</option>
              <option value="ISSUE">Issues / Work Orders</option>
              <option value="INSPECTION_TEMPLATE">Templates</option>
              <option value="USER">User Authentication</option>
              <option value="CONFLICT">Sync Conflicts</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8 text-muted" />}
          title="No Audit Records"
          description="System events and transactions will appear here as operations are performed."
        />
      ) : (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type / ID</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Version Token</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-ivory/50">
                  <td className="p-3 tabular-nums text-muted">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-charcoal">{log.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-charcoal">{log.entityType}</span>
                    <span className="text-[10px] font-mono text-muted block">
                      {log.entityId?.substring(0, 8)}...
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-charcoal">{log.actorEmail || 'System'}</span>
                    {log.actorRole && (
                      <Badge variant="sand" size="sm" className="ml-1 text-[10px]">
                        {log.actorRole.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 tabular-nums font-mono text-muted">
                    {log.previousVersion !== undefined && log.newVersion !== undefined
                      ? `v${log.previousVersion} → v${log.newVersion}`
                      : log.newVersion !== undefined
                      ? `v${log.newVersion}`
                      : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setSelectedLog(log)}
                    >
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details JSON Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
        description={selectedLog?.action}
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-sand-light/40 rounded border border-warm">
              <div>
                <span className="text-muted block text-[10px] uppercase">Actor Email</span>
                <span className="font-semibold text-charcoal">{selectedLog.actorEmail}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">IP Address</span>
                <span className="font-mono text-charcoal">{selectedLog.ipAddress || 'Internal'}</span>
              </div>
            </div>

            <pre className="font-mono text-[11px] bg-charcoal-dark text-ivory p-3 rounded overflow-x-auto max-h-64">
              {JSON.stringify(selectedLog.details, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};
