import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Building, Clock, User, ArrowRight, Plus } from 'lucide-react';
import { templateApi, InspectionSchedule } from '../../api/templateApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';

export const SchedulesList: React.FC = () => {
  const { isManager } = useAuth();
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    templateApi.getSchedules().then((res) => {
      if (res.success && res.data) {
        setSchedules(res.data);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Inspection Schedules
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Automated recurring audit frequencies, due dates, and staff assignments
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-muted" />}
          title="No Active Inspection Schedules"
          description="Schedules automate recurring audits across facilities."
        />
      ) : (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Facility</th>
                <th className="p-3">Inspection Template</th>
                <th className="p-3">Cadence</th>
                <th className="p-3">Next Due Date</th>
                <th className="p-3">Assigned Inspector</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {schedules.map((s) => {
                const isOverdue = new Date(s.nextDueDate) < new Date();
                return (
                  <tr key={s.id} className="hover:bg-ivory/50">
                    <td className="p-3 font-semibold text-charcoal">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-terracotta" />
                        <span>{s.facility?.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-charcoal font-medium">
                      {s.template?.name} (v{s.template?.version})
                    </td>
                    <td className="p-3">
                      <Badge variant="sand" size="sm">
                        {s.frequency}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted" />
                        <span
                          className={`font-semibold tabular-nums ${
                            isOverdue ? 'text-crimson' : 'text-charcoal'
                          }`}
                        >
                          {new Date(s.nextDueDate).toLocaleDateString()}
                        </span>
                        {isOverdue && (
                          <Badge variant="crimson" size="sm">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted">
                      {s.assignedTo?.fullName || 'Unassigned'}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/inspections/new?facilityId=${s.facilityId}&templateId=${s.templateId}`}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Launch Now
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
