import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Plus,
  QrCode,
  RefreshCw,
  TrendingUp,
  Building,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { analyticsApi, AnalyticsDashboardData } from '../api/analyticsApi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge, Badge } from '../components/common/Badge';
import { Skeleton } from '../components/common/Skeleton';

export const Dashboard: React.FC = () => {
  const { user, isManager, isInspector, isTechnician } = useAuth();
  const { isOnline, pendingCount, syncNow, isSyncing } = useSync();

  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.getDashboardData();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Role: <span className="font-medium text-charcoal">{user?.role?.replace(/_/g, ' ')}</span> &bull; Facility Inspection and Maintenance Portal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isManager || isInspector) && (
            <Link to="/inspections/new">
              <Button size="sm" variant="primary" icon={<Plus className="w-4 h-4" />}>
                Start Inspection
              </Button>
            </Link>
          )}

          {(isManager || isInspector) && (
            <Link to="/checkpoints/scan">
              <Button size="sm" variant="outline" icon={<QrCode className="w-4 h-4" />}>
                Scan QR Checkpoint
              </Button>
            </Link>
          )}

          <Link to="/work-orders">
            <Button size="sm" variant="secondary" icon={<AlertTriangle className="w-4 h-4" />}>
              Work Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Inspections Completed */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted tracking-wide">
              Completed (Month)
            </span>
            <div className="w-8 h-8 rounded bg-sage-bg text-sage flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className="text-2xl font-bold text-charcoal tabular-nums">
                {data?.metrics.inspectionsCompletedMonth ?? 0}
              </span>
            )}
            <span className="text-[11px] text-muted">
              {loading ? '' : `${data?.metrics.inspectionsCompletionRate ?? 0}% rate`}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{data?.metrics.inspectionsDuePending ?? 0} upcoming / due</span>
          </div>
        </Card>

        {/* Metric 2: Open Work Orders */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted tracking-wide">
              Open Work Orders
            </span>
            <div className="w-8 h-8 rounded bg-amber-bg text-amber flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className="text-2xl font-bold text-charcoal tabular-nums">
                {data?.metrics.openWorkOrders ?? 0}
              </span>
            )}
            <span className="text-[11px] text-amber font-medium">
              {loading ? '' : `${data?.metrics.overdueWorkOrders ?? 0} overdue`}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Avg resolution: {data?.metrics.avgResolutionTimeHours ?? 0}h</span>
          </div>
        </Card>

        {/* Metric 3: Critical Severity Issues */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted tracking-wide">
              Critical Defects
            </span>
            <div className="w-8 h-8 rounded bg-crimson-bg text-crimson flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className="text-2xl font-bold text-crimson tabular-nums">
                {data?.metrics.criticalWorkOrders ?? 0}
              </span>
            )}
            <span className="text-[11px] text-muted">require urgent action</span>
          </div>
          <div className="mt-2 text-[11px] text-muted">
            <span>Server-enforced verified sign-off</span>
          </div>
        </Card>

        {/* Metric 4: Offline Outbox Queue */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted tracking-wide">
              Sync Outbox
            </span>
            <div className="w-8 h-8 rounded bg-sand-light text-charcoal flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-charcoal tabular-nums">
              {pendingCount}
            </span>
            <span className="text-[11px] text-muted">pending upload</span>
          </div>
          <div className="mt-2 text-[11px] flex items-center justify-between text-muted">
            <span>{isOnline ? 'Network ready' : 'Offline local storage'}</span>
            {pendingCount > 0 && isOnline && (
              <button
                onClick={() => syncNow()}
                disabled={isSyncing}
                className="text-terracotta hover:underline font-semibold"
              >
                Sync now
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* 2-Column Section: Frequent Checkpoint Failures & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frequent Failures */}
        <Card
          title="Frequent Defect Checkpoints"
          subtitle="Areas with repeated inspection checkpoint failures"
          action={
            <Link to="/facilities" className="text-xs text-terracotta hover:underline font-medium">
              View All
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : !data?.frequentFailures?.length ? (
            <div className="py-8 text-center text-xs text-muted">
              No repeated checkpoint failures recorded.
            </div>
          ) : (
            <div className="divide-y divide-warm">
              {data.frequentFailures.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-charcoal">{item.checkpointName}</p>
                    <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3" />
                      <span>{item.facilityName}</span>
                    </p>
                  </div>
                  <Badge variant="crimson" size="sm">
                    {item.failureCount} Failures
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Audit History Activity */}
        <Card
          title="Recent Audit Activity"
          subtitle="Immutable security and operational events log"
          action={
            isManager ? (
              <Link to="/audit" className="text-xs text-terracotta hover:underline font-medium">
                Full Log
              </Link>
            ) : null
          }
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : !data?.recentActivity?.length ? (
            <div className="py-8 text-center text-xs text-muted">
              No recent audit records available.
            </div>
          ) : (
            <div className="divide-y divide-warm">
              {data.recentActivity.slice(0, 5).map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-charcoal">
                      {act.action.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-muted mt-0.5">
                      By {act.actorName} &bull; {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant="sand" size="sm">
                    {new Date(act.timestamp).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Issue Distribution by Severity & Facility Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Defects by Severity" subtitle="Current active work order priority" className="lg:col-span-1">
          {loading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2 mt-1">
              {(data?.issuesBySeverity || []).map((s) => (
                <div key={s.severity} className="flex items-center justify-between text-xs py-1.5 border-b border-warm/50 last:border-none">
                  <span className="font-medium text-charcoal">{s.severity}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold text-charcoal">{s.count}</span>
                    <StatusBadge status={s.severity} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Facility Breakdown" subtitle="Distribution across active facilities" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2 mt-1">
              {(data?.issuesByFacility || []).map((fac) => (
                <div key={fac.facilityName} className="flex items-center justify-between text-xs py-1.5 border-b border-warm/50 last:border-none">
                  <span className="font-semibold text-charcoal">{fac.facilityName}</span>
                  <span className="tabular-nums font-medium text-muted">
                    {fac.count} active issues
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
