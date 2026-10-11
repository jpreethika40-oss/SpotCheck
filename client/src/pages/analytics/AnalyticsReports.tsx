import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Download, FileText, BarChart3, Building, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { analyticsApi, AnalyticsDashboardData, reportApi } from '../../api/analyticsApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Skeleton';
import { Badge } from '../../components/common/Badge';

export const AnalyticsReports: React.FC = () => {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingInsp, setExportingInsp] = useState(false);
  const [exportingWo, setExportingWo] = useState(false);

  useEffect(() => {
    setLoading(true);
    analyticsApi.getDashboardData().then((res) => {
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });
  }, []);

  const handleExportInspectionsCsv = async () => {
    setExportingInsp(true);
    try {
      const blob = await reportApi.exportInspectionsCsv();
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spotcheck_inspections_${new Date().toISOString().substring(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setExportingInsp(false);
    }
  };

  const handleExportWorkOrdersCsv = async () => {
    setExportingWo(true);
    try {
      const blob = await reportApi.exportWorkOrdersCsv();
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spotcheck_work_orders_${new Date().toISOString().substring(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setExportingWo(false);
    }
  };

  // Strictly compliant color palette
  const CHART_COLORS = ['#C66B4E', '#687568', '#B98535', '#302F2A', '#DED2C0', '#A33F35'];

  if (loading) return <TableSkeleton rows={8} cols={4} />;

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Analytics & Compliance Reports
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Operational trend aggregation, checkpoint failure rates, and CSV batch exports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-4 h-4" />}
            loading={exportingInsp}
            onClick={handleExportInspectionsCsv}
          >
            Export Inspections (CSV)
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            loading={exportingWo}
            onClick={handleExportWorkOrdersCsv}
          >
            Export Work Orders (CSV)
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Inspection Completion Trends */}
        <Card title="Monthly Completed Inspections" subtitle="Audits submitted across facilities">
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.inspectionsByMonth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6DED2" vertical={false} />
                <XAxis dataKey="month" stroke="#77736B" fontSize={11} tickLine={false} />
                <YAxis stroke="#77736B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E6DED2',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#292824',
                  }}
                />
                <Bar dataKey="completed" name="Completed Audits" fill="#C66B4E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Issues by Category */}
        <Card title="Defects by Equipment Category" subtitle="Distribution of detected facility issues">
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.issuesByCategory || []}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  fontSize={11}
                >
                  {(data?.issuesByCategory || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E6DED2',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Repeated Checkpoint Failures Table */}
      <Card
        title="Checkpoints with Repeated Failures"
        subtitle="Identified mechanical and safety bottlenecks requiring preventive maintenance overhaul"
      >
        {!data?.frequentFailures?.length ? (
          <p className="py-6 text-center text-xs text-muted">
            No repeated checkpoint failures recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Checkpoint Name</th>
                  <th className="p-3">Facility</th>
                  <th className="p-3">Failure Incidents</th>
                  <th className="p-3">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm">
                {data.frequentFailures.map((item, idx) => (
                  <tr key={idx} className="hover:bg-ivory/50">
                    <td className="p-3 font-bold text-charcoal">{item.checkpointName}</td>
                    <td className="p-3 text-muted">{item.facilityName}</td>
                    <td className="p-3 font-bold text-crimson tabular-nums">
                      {item.failureCount} Failures
                    </td>
                    <td className="p-3">
                      <Badge variant="crimson" size="sm">
                        Urgent Review
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
