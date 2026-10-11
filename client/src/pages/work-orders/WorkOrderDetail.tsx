import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building,
  Shield,
  Send,
  FileText,
  RotateCcw,
  Check,
  AlertCircle,
  History,
} from 'lucide-react';
import { Issue, WorkOrderStatus, WORK_ORDER_STATE_TRANSITIONS } from '@spotcheck/shared';
import { workOrderApi, TransitionPayload } from '../../api/workOrderApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input, Textarea, Select } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const WorkOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isManager, isTechnician } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Transition Dialog State
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | null>(null);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const fetchWorkOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await workOrderApi.getWorkOrderById(id);
      if (res.success && res.data) {
        setIssue(res.data);
        setEvents((res.data as any).events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  const handleOpenTransition = (to: WorkOrderStatus) => {
    setTargetStatus(to);
    setTransitionNotes('');
    setResolutionNotes(issue?.resolutionNotes || '');
    setRejectionReason('');
    setTransitionError(null);
    setTransitionModalOpen(true);
  };

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !targetStatus || !id) return;

    setSubmitting(true);
    setTransitionError(null);

    const payload: TransitionPayload = {
      toStatus: targetStatus,
      currentVersion: issue.version,
      notes: transitionNotes || undefined,
      resolutionNotes: targetStatus === 'RESOLVED' ? resolutionNotes : undefined,
      rejectionReason:
        issue.status === 'RESOLVED' && targetStatus === 'IN_PROGRESS'
          ? rejectionReason
          : undefined,
    };

    try {
      const res = await workOrderApi.transitionStatus(id, payload);
      if (res.success) {
        setTransitionModalOpen(false);
        fetchWorkOrder();
      } else {
        setTransitionError(res.error?.message || 'Transition rejected by server rules.');
      }
    } catch (err: any) {
      setTransitionError(err.message || 'Transition failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <TableSkeleton rows={5} cols={3} />;

  if (!issue) {
    return (
      <EmptyState
        title="Work Order Not Found"
        description="The requested work order could not be located."
        action={
          <Link to="/work-orders">
            <Button size="sm" variant="secondary">
              Back to Work Orders
            </Button>
          </Link>
        }
      />
    );
  }

  const validNextStates = WORK_ORDER_STATE_TRANSITIONS[issue.status] || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/work-orders"
        className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Work Orders</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-charcoal">{issue.title}</h1>
            <StatusBadge status={issue.status} size="sm" />
            <StatusBadge status={issue.severity} size="sm" />
          </div>
          <p className="text-xs text-muted mt-1">
            Facility: <strong className="text-charcoal">{issue.facilityName}</strong> &bull; Version Concurrency Token:{' '}
            <strong className="font-mono text-charcoal">v{issue.version}</strong>
          </p>
        </div>

        {/* Permitted state transition buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {validNextStates.map((nextSt) => {
            const isVerification = nextSt === 'VERIFIED';
            const isRejection = issue.status === 'RESOLVED' && nextSt === 'IN_PROGRESS';

            return (
              <Button
                key={nextSt}
                size="sm"
                variant={isVerification ? 'primary' : isRejection ? 'danger' : 'secondary'}
                onClick={() => handleOpenTransition(nextSt)}
                icon={
                  isVerification ? (
                    <Check className="w-4 h-4" />
                  ) : isRejection ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )
                }
              >
                {isRejection ? 'Reject & Reopen' : `Advance to ${nextSt.replace(/_/g, ' ')}`}
              </Button>
            );
          })}
        </div>
      </div>

      {/* State Machine Status Flow Banner */}
      <div className="bg-surface border border-warm rounded-md p-4 flex items-center justify-between text-xs overflow-x-auto shadow-subtle">
        {(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED'] as WorkOrderStatus[]).map(
          (step, idx) => {
            const isCurrent = issue.status === step;
            const stepOrder = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED'];
            const isPassed = stepOrder.indexOf(issue.status) > idx;

            return (
              <div key={step} className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] ${
                    isCurrent
                      ? 'bg-terracotta text-white shadow-sm'
                      : isPassed
                      ? 'bg-sage-bg text-sage border border-[#D5DDD5]'
                      : 'bg-sand-light text-muted'
                  }`}
                >
                  {isPassed ? <Check className="w-3 h-3" /> : idx + 1}. {step.replace(/_/g, ' ')}
                </div>
                {idx < 4 && <span className="text-muted/60">&rarr;</span>}
              </div>
            );
          }
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Defect Particulars">
          <dl className="divide-y divide-warm text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Category</dt>
              <dd className="font-semibold text-charcoal">{issue.category}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Assigned Technician</dt>
              <dd className="font-semibold text-charcoal">{issue.assignedToName || 'Unassigned'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Reported By</dt>
              <dd className="text-charcoal">{issue.reportedByName || 'Inspector'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Due Date</dt>
              <dd className="text-charcoal">
                {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'Not Set'}
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-muted mb-1 font-medium">Issue Description</dt>
              <dd className="text-charcoal whitespace-pre-wrap bg-[#FCFAF6] p-2.5 rounded border border-warm">
                {issue.description}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Resolution & Verification Sign-off">
          <dl className="divide-y divide-warm text-xs">
            <div className="py-2.5">
              <dt className="text-muted mb-1 font-semibold">Technician Work Resolution Notes</dt>
              <dd className="text-charcoal bg-[#FCFAF6] p-2.5 rounded border border-warm">
                {issue.resolutionNotes || 'No resolution notes entered yet.'}
              </dd>
            </div>

            <div className="py-2.5">
              <dt className="text-muted mb-1 font-semibold">Manager Verification Notes</dt>
              <dd className="text-charcoal bg-[#FCFAF6] p-2.5 rounded border border-warm">
                {issue.verificationNotes || 'Awaiting final verification sign-off.'}
              </dd>
            </div>

            {issue.verifiedByName && (
              <div className="py-2.5 flex justify-between">
                <dt className="text-muted">Verified By</dt>
                <dd className="font-semibold text-sage">{issue.verifiedByName}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* State Transition History Timeline */}
      <Card title="Audit State Machine History Timeline" subtitle="Server-enforced transition event trail">
        {events.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">No state transitions recorded yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-warm ml-2 my-2">
            {events.map((ev: any) => (
              <div key={ev.id} className="relative text-xs">
                <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-terracotta border-2 border-white" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-charcoal">
                    {ev.fromStatus} &rarr; {ev.toStatus}
                  </span>
                  <span className="text-muted">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>
                </div>
                {ev.notes && <p className="text-muted mt-1 bg-[#FCFAF6] p-2 rounded">{ev.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* State Transition Action Modal */}
      <Modal
        isOpen={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        title={`Advance Work Order to ${targetStatus?.replace(/_/g, ' ')}`}
        description="Verify business rules and record required notes."
      >
        <form onSubmit={handleExecuteTransition} className="space-y-4">
          {transitionError && (
            <div className="p-3 bg-crimson-bg border border-[#F2D6D3] text-crimson text-xs font-semibold rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}

          {targetStatus === 'RESOLVED' && (
            <Textarea
              label="Work Performed / Resolution Notes (Required)"
              required
              placeholder="Detail the mechanical or electrical repairs performed, replacement parts installed, and verification measurements..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
          )}

          {issue.status === 'RESOLVED' && targetStatus === 'IN_PROGRESS' && (
            <Textarea
              label="Rejection Reason (Required)"
              required
              placeholder="Explain why the repair failed verification and what remaining corrections are needed..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          )}

          <Textarea
            label="Additional Transition Notes"
            placeholder="Operational notes or comments..."
            value={transitionNotes}
            onChange={(e) => setTransitionNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTransitionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Confirm Transition
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
