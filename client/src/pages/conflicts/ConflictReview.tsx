import React, { useEffect, useState } from 'react';
import { GitMerge, Check, X, AlertTriangle, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { syncApi, ConflictRecord } from '../../api/syncApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Textarea } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';

export const ConflictReview: React.FC = () => {
  const { isManager } = useAuth();
  const { refreshCounts } = useSync();

  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [strategy, setStrategy] = useState<'ACCEPT_SERVER' | 'FORCE_CLIENT' | 'MANUAL_MERGE'>('ACCEPT_SERVER');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await syncApi.getConflicts();
      if (res.success && res.data) {
        setConflicts(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleOpenResolve = (conflict: ConflictRecord) => {
    setSelectedConflict(conflict);
    setStrategy('ACCEPT_SERVER');
    setResolutionNotes('');
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConflict) return;

    setSubmitting(true);
    try {
      const res = await syncApi.resolveConflict(selectedConflict.id, {
        resolutionStrategy: strategy,
        resolutionNotes,
      });

      if (res.success) {
        setResolveModalOpen(false);
        fetchConflicts();
        refreshCounts();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Concurrent-Edit Conflict Review
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Optimistic concurrency control: field-level conflict detection and explainable human reconciliation
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-sage" />}
          title="No Open Synchronization Conflicts"
          description="All offline and online edits across facilities have synchronized with consistent versions."
        />
      ) : (
        <div className="space-y-4">
          {conflicts.map((c) => {
            const conflictingFields = c.conflictingFields || [];
            const isResolved = c.status === 'RESOLVED';

            return (
              <Card key={c.id} padding="md" className={isResolved ? 'opacity-70' : 'border-amber'}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-warm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted">
                        ID: {c.recordId.substring(0, 8)}...
                      </span>
                      <StatusBadge status={c.status} size="sm" />
                      <Badge variant="sand" size="sm">
                        {c.entityType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Detected: {new Date(c.createdAt).toLocaleString()} &bull; Base Version:{' '}
                      <strong>v{c.baseVersion}</strong> vs Server <strong>v{c.serverVersion}</strong> vs Local{' '}
                      <strong>v{c.clientVersion}</strong>
                    </p>
                  </div>

                  {!isResolved && isManager && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<GitMerge className="w-4 h-4" />}
                      onClick={() => handleOpenResolve(c)}
                    >
                      Reconcile Conflict
                    </Button>
                  )}
                </div>

                {/* Conflicting Fields comparison */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Local Client Version */}
                  <div className="bg-[#FAF8F5] p-3 rounded border border-warm space-y-2">
                    <span className="text-[11px] font-bold text-terracotta uppercase block">
                      Local Client Version (Offline Upload)
                    </span>
                    <pre className="text-[11px] text-charcoal font-mono bg-white p-2 rounded border border-warm overflow-x-auto max-h-48">
                      {JSON.stringify(c.payloadLocal, null, 2)}
                    </pre>
                  </div>

                  {/* Server Version */}
                  <div className="bg-[#FAF8F5] p-3 rounded border border-warm space-y-2">
                    <span className="text-[11px] font-bold text-sage uppercase block">
                      Current Server Version (Target DB)
                    </span>
                    <pre className="text-[11px] text-charcoal font-mono bg-white p-2 rounded border border-warm overflow-x-auto max-h-48">
                      {JSON.stringify(c.payloadServer, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Conflicting Field Tags */}
                {conflictingFields.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-muted font-medium">Overlapping Fields:</span>
                    {conflictingFields.map((field) => (
                      <Badge key={field} variant="crimson" size="sm">
                        {field}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Reconciliation Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Synchronization Conflict"
        description="Select a deterministic resolution policy. Action will be committed to the audit trail."
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-charcoal">
              Reconciliation Strategy
            </label>
            <div className="space-y-2">
              <label
                className={`p-3 rounded border flex items-start gap-3 cursor-pointer text-xs ${
                  strategy === 'ACCEPT_SERVER'
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-warm bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="strat"
                  checked={strategy === 'ACCEPT_SERVER'}
                  onChange={() => setStrategy('ACCEPT_SERVER')}
                  className="mt-0.5 text-terracotta"
                />
                <div>
                  <strong className="block text-charcoal">Accept Current Server Version</strong>
                  <span className="text-muted text-[11px]">
                    Preserves data currently in PostgreSQL database and dismisses conflicting offline client overwrite.
                  </span>
                </div>
              </label>

              <label
                className={`p-3 rounded border flex items-start gap-3 cursor-pointer text-xs ${
                  strategy === 'FORCE_CLIENT'
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-warm bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="strat"
                  checked={strategy === 'FORCE_CLIENT'}
                  onChange={() => setStrategy('FORCE_CLIENT')}
                  className="mt-0.5 text-terracotta"
                />
                <div>
                  <strong className="block text-charcoal">Force Client Offline Version</strong>
                  <span className="text-muted text-[11px]">
                    Applies the offline technician's edits, incrementing the version token and archiving competing changes.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <Textarea
            label="Resolution Audit Rationale (Required)"
            required
            placeholder="Explain why this resolution was chosen for facility compliance..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResolveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Apply & Reconcile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
