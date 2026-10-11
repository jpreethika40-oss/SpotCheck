import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Clock,
  ArrowRight,
  ShieldAlert,
  User,
  Building,
} from 'lucide-react';
import { Issue, WorkOrderStatus, IssueSeverity } from '@spotcheck/shared';
import { workOrderApi } from '../../api/workOrderApi';
import { facilityApi } from '../../api/facilityApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input, Select, Textarea } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const WorkOrdersList: React.FC = () => {
  const { user, isManager, isTechnician } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({
    facilityId: '',
    title: '',
    description: '',
    category: 'HVAC',
    severity: 'MEDIUM' as IssueSeverity,
    dueDate: '',
  });

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const res = await workOrderApi.getWorkOrders({
        search: search || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      if (res.success && res.data) {
        setIssues(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    facilityApi.getFacilities().then((r) => {
      if (r.success && r.data) setFacilities(r.data);
    });
  }, [statusFilter, severityFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await workOrderApi.createWorkOrder(newOrder);
    if (res.success) {
      setCreateOpen(false);
      setNewOrder({
        facilityId: '',
        title: '',
        description: '',
        category: 'HVAC',
        severity: 'MEDIUM',
        dueDate: '',
      });
      fetchWorkOrders();
    }
  };

  const columns: { status: WorkOrderStatus; title: string }[] = [
    { status: 'REPORTED', title: 'Reported' },
    { status: 'ASSIGNED', title: 'Assigned' },
    { status: 'IN_PROGRESS', title: 'In Progress' },
    { status: 'RESOLVED', title: 'Resolved' },
    { status: 'VERIFIED', title: 'Verified' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Work Orders & Defect Tracking
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Server-enforced lifecycle: Reported &rarr; Assigned &rarr; In Progress &rarr; Resolved &rarr; Verified
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="border border-warm rounded p-0.5 flex bg-surface">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                viewMode === 'table' ? 'bg-terracotta text-white' : 'text-muted hover:text-charcoal'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                viewMode === 'board' ? 'bg-terracotta text-white' : 'text-muted hover:text-charcoal'
              }`}
            >
              Workflow Board
            </button>
          </div>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Log Defect
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search work orders by title, description, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            />
          </div>

          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Statuses</option>
              <option value="REPORTED">Reported</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </div>

          <div className="w-full sm:w-44">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Content: Board or Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-muted" />}
          title="No work orders found"
          description="All facility issues are currently resolved or match no active filters."
        />
      ) : viewMode === 'table' ? (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Issue Title / Category</th>
                <th className="p-3">Facility</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assignee</th>
                <th className="p-3">Due Date</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {issues.map((wo) => {
                const isOverdue = wo.dueDate && new Date(wo.dueDate) < new Date() && wo.status !== 'VERIFIED';
                return (
                  <tr key={wo.id} className="hover:bg-ivory/50">
                    <td className="p-3">
                      <span className="font-semibold text-charcoal block">{wo.title}</span>
                      <span className="text-[11px] text-muted">{wo.category}</span>
                    </td>
                    <td className="p-3 text-charcoal">{wo.facilityName}</td>
                    <td className="p-3">
                      <StatusBadge status={wo.severity} size="sm" />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={wo.status} size="sm" />
                    </td>
                    <td className="p-3 text-muted">{wo.assignedToName || 'Unassigned'}</td>
                    <td className="p-3 tabular-nums">
                      {wo.dueDate ? (
                        <span className={isOverdue ? 'text-crimson font-bold' : 'text-muted'}>
                          {new Date(wo.dueDate).toLocaleDateString()}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="text-xs font-semibold text-terracotta hover:underline inline-flex items-center gap-1"
                      >
                        <span>Manage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
          {columns.map((col) => {
            const colIssues = issues.filter((i) => i.status === col.status);
            return (
              <div key={col.status} className="bg-sand-light/40 border border-warm rounded-md p-3 flex flex-col min-w-[240px]">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-warm">
                  <h3 className="text-xs font-bold text-charcoal">{col.title}</h3>
                  <span className="text-xs font-bold bg-white border border-warm px-1.5 py-0.2 rounded-full tabular-nums">
                    {colIssues.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {colIssues.map((item) => (
                    <Link key={item.id} to={`/work-orders/${item.id}`}>
                      <Card padding="sm" className="hover:border-terracotta transition-colors shadow-subtle mb-2">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <StatusBadge status={item.severity} size="sm" />
                          <span className="text-[10px] text-muted">{item.category}</span>
                        </div>
                        <h4 className="text-xs font-bold text-charcoal line-clamp-2">{item.title}</h4>
                        <div className="mt-2 pt-2 border-t border-warm/60 flex items-center justify-between text-[11px] text-muted">
                          <span>{item.facilityName}</span>
                          <span>{item.assignedToName || 'Unassigned'}</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Defect Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log Facility Defect / Work Order"
        description="Create an issue requiring technician repair and verified sign-off."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3">
          <Select
            label="Facility"
            required
            value={newOrder.facilityId}
            onChange={(e) => setNewOrder({ ...newOrder, facilityId: e.target.value })}
          >
            <option value="">Select Facility...</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </Select>

          <Input
            label="Defect Title"
            required
            placeholder="e.g. Chilled Water Pump 2 Bearing Noise"
            value={newOrder.title}
            onChange={(e) => setNewOrder({ ...newOrder, title: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={newOrder.category}
              onChange={(e) => setNewOrder({ ...newOrder, category: e.target.value })}
              options={[
                { value: 'HVAC', label: 'HVAC' },
                { value: 'Electrical', label: 'Electrical' },
                { value: 'Plumbing', label: 'Plumbing' },
                { value: 'Safety', label: 'Safety' },
                { value: 'Structural', label: 'Structural' },
                { value: 'Elevator', label: 'Elevator' },
              ]}
            />

            <Select
              label="Severity"
              value={newOrder.severity}
              onChange={(e) => setNewOrder({ ...newOrder, severity: e.target.value as IssueSeverity })}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </div>

          <Textarea
            label="Description"
            required
            placeholder="Detailed description of defect and observed symptoms..."
            value={newOrder.description}
            onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
          />

          <Input
            label="Target Completion Due Date"
            type="date"
            value={newOrder.dueDate}
            onChange={(e) => setNewOrder({ ...newOrder, dueDate: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create Work Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
