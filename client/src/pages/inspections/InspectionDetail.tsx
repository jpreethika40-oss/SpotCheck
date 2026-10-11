import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Download,
  ArrowLeft,
  Building,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { InspectionRecord } from '@spotcheck/shared';
import { inspectionApi } from '../../api/inspectionApi';
import { db } from '../../offline/db';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const InspectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const loadInspection = async () => {
      // Check server first
      try {
        const res = await inspectionApi.getInspectionById(id);
        if (res.success && res.data) {
          setInspection(res.data);
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to local IndexedDB
      }

      // Check Dexie
      const local = await db.offlineInspections.get(id);
      if (local) {
        setInspection(local as any);
      }
      setLoading(false);
    };

    loadInspection();
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloading(true);
    try {
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
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <TableSkeleton rows={6} cols={4} />;

  if (!inspection) {
    return (
      <EmptyState
        title="Inspection Not Found"
        description="The requested audit record is not available."
        action={
          <Link to="/inspections">
            <Button size="sm" variant="secondary">
              Back to Inspections
            </Button>
          </Link>
        }
      />
    );
  }

  const items = (inspection.items as any[]) || [];
  const passedCount = items.filter((i) => i.result === 'PASS').length;
  const failedCount = items.filter((i) => i.result === 'FAIL').length;
  const naCount = items.filter((i) => i.result === 'NA').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/inspections"
        className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Inspections List</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-charcoal">
              {inspection.templateName || 'Inspection Record'}
            </h1>
            <StatusBadge status={inspection.status} size="sm" />
            <Badge variant="sand" size="sm">
              v{inspection.version}
            </Badge>
          </div>
          <p className="text-xs text-muted mt-1">
            Facility: <strong className="text-charcoal">{inspection.facilityName || 'Facility'}</strong> &bull; Completed{' '}
            {inspection.completedAt
              ? new Date(inspection.completedAt).toLocaleString()
              : new Date(inspection.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            loading={downloading}
            onClick={handleDownloadPdf}
          >
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* Summary Scorecard */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <Card padding="sm" className="bg-sage-bg/30 border-[#D5DDD5]">
          <span className="text-[10px] font-bold text-sage uppercase tracking-wider block">Passed</span>
          <span className="text-2xl font-bold text-sage tabular-nums">{passedCount}</span>
        </Card>
        <Card padding="sm" className="bg-crimson-bg/30 border-[#F2D6D3]">
          <span className="text-[10px] font-bold text-crimson uppercase tracking-wider block">Failed / Defect</span>
          <span className="text-2xl font-bold text-crimson tabular-nums">{failedCount}</span>
        </Card>
        <Card padding="sm" className="bg-sand-light/50 border-warm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Not Applicable</span>
          <span className="text-2xl font-bold text-charcoal tabular-nums">{naCount}</span>
        </Card>
      </div>

      {inspection.summaryNotes && (
        <Card title="Summary & Field Notes">
          <p className="text-xs text-charcoal whitespace-pre-wrap">{inspection.summaryNotes}</p>
        </Card>
      )}

      {/* Checkpoint responses */}
      <Card title="Item Responses & Evidence">
        <div className="divide-y divide-warm">
          {items.map((item, idx) => (
            <div key={idx} className="py-3.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {item.result === 'PASS' && <CheckCircle2 className="w-4 h-4 text-sage" />}
                  {item.result === 'FAIL' && <XCircle className="w-4 h-4 text-crimson" />}
                  {item.result === 'NA' && <MinusCircle className="w-4 h-4 text-muted" />}
                  <h4 className="text-xs font-bold text-charcoal">{item.label}</h4>
                </div>
                <StatusBadge status={item.result || 'PENDING'} size="sm" />
              </div>

              {item.numericValue !== undefined && (
                <p className="text-xs text-muted pl-6">
                  Reading Value: <strong className="text-charcoal">{item.numericValue}</strong>
                </p>
              )}

              {item.notes && (
                <p className="text-xs text-muted pl-6 bg-[#FCFAF6] p-2 rounded border border-warm/60">
                  Notes: {item.notes}
                </p>
              )}

              {item.isFlaggedDefect && (
                <div className="ml-6 flex items-center gap-1.5 text-xs text-crimson font-medium bg-crimson-bg/40 p-2 rounded border border-[#F2D6D3]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Defect Flagged: Automated work order created</span>
                </div>
              )}

              {item.attachmentIds?.length > 0 && (
                <div className="pl-6 flex items-center gap-2 pt-1 text-xs text-muted">
                  <Camera className="w-3.5 h-3.5 text-terracotta" />
                  <span>{item.attachmentIds.length} photo evidence attached</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
