import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Building,
  User,
  Calendar,
  Download,
  ArrowRight,
  WifiOff,
} from 'lucide-react';
import { InspectionRecord } from '@spotcheck/shared';
import { inspectionApi } from '../../api/inspectionApi';
import { db } from '../../offline/db';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';

export const InspectionsList: React.FC = () => {
  const { isManager, isInspector } = useAuth();
  const { isOnline } = useSync();

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInspections = async () => {
    setLoading(true);
    try {
      // 1. Fetch local IndexedDB offline drafts and pending items
      const localItems = await db.offlineInspections.toArray();
      setOfflineDrafts(localItems.filter((i) => i.syncStatus !== 'SYNCED'));

      // 2. If online, fetch from backend server
      if (isOnline) {
        const res = await inspectionApi.getInspections({
          status: statusFilter || undefined,
        });
        if (res.success && res.data) {
          setInspections(res.data);
        }
      }
    } catch (err) {
      console.warn('Could not load server inspections; offline fallback active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [statusFilter, isOnline]);

  const handleDownloadPdf = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const blob = await inspectionApi.downloadInspectionPdf(id);
    if (blob) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_report_${id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Facility Inspections
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Audit checklists, physical verification logs, defect tracking, and PDF compliance reports
          </p>
        </div>

        {(isManager || isInspector) && (
          <Link to="/inspections/new">
            <Button size="sm" variant="primary" icon={<Plus className="w-4 h-4" />}>
              Start New Inspection
            </Button>
          </Link>
        )}
      </div>

      {/* Offline Drafts Banner if any exist */}
      {offlineDrafts.length > 0 && (
        <Card padding="md" className="border-amber bg-amber-bg/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-bg text-amber flex items-center justify-center font-bold text-xs">
                {offlineDrafts.length}
              </span>
              <div>
                <h4 className="text-xs font-bold text-charcoal">
                  Local Offline Drafts & Pending Inspections
                </h4>
                <p className="text-[11px] text-muted">
                  These records are stored locally in IndexedDB and survive browser restarts.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 divide-y divide-warm/60">
            {offlineDrafts.map((draft) => (
              <div key={draft.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-charcoal">
                    {draft.summaryNotes || 'Draft Inspection'}
                  </span>
                  <span className="text-muted ml-2">
                    Started {new Date(draft.startedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={draft.syncStatus === 'PENDING' ? 'amber' : 'sand'} size="sm">
                    {draft.syncStatus}
                  </Badge>
                  <Link to={`/inspections/run/${draft.id}`}>
                    <Button size="sm" variant="secondary" className="py-1 h-7">
                      Resume
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="VERIFIED">Verified</option>
              <option value="FLAGGED">Flagged</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Inspections Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : inspections.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-8 h-8 text-muted" />}
          title="No inspections found"
          description="Complete an inspection to record physical checkpoints and defect statuses."
        />
      ) : (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Facility / Checkpoint</th>
                <th className="p-3">Template</th>
                <th className="p-3">Inspector</th>
                <th className="p-3">Status</th>
                <th className="p-3">Completed At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-ivory/50">
                  <td className="p-3">
                    <span className="font-semibold text-charcoal block">
                      {insp.facilityName || 'Facility'}
                    </span>
                    <span className="text-[11px] text-muted">
                      {insp.checkpointName ? `Checkpoint: ${insp.checkpointName}` : 'General Inspection'}
                    </span>
                  </td>
                  <td className="p-3 text-charcoal font-medium">
                    {insp.templateName} (v{insp.templateVersion})
                  </td>
                  <td className="p-3 text-muted">{insp.inspectorName || 'Staff'}</td>
                  <td className="p-3">
                    <StatusBadge status={insp.status} size="sm" />
                  </td>
                  <td className="p-3 tabular-nums text-muted">
                    {insp.completedAt
                      ? new Date(insp.completedAt).toLocaleDateString()
                      : new Date(insp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={(e) => handleDownloadPdf(e, insp.id)}
                      title="Download PDF Inspection Report"
                    >
                      PDF
                    </Button>
                    <Link
                      to={`/inspections/${insp.id}`}
                      className="font-semibold text-terracotta hover:underline inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
