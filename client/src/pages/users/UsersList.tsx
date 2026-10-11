import React, { useEffect, useState } from 'react';
import { Users, Shield, UserCheck, ToggleLeft, ToggleRight, UserX } from 'lucide-react';
import { userApi } from '../../api/auditApi';
import { UserSummary, UserRole } from '@spotcheck/shared';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/AuthContext';

export const UsersList: React.FC = () => {
  const { user: currentUser, isManager } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getUsers();
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: UserSummary) => {
    if (!isManager) return;
    const res = await userApi.updateUserStatus(user.id, !user.isActive);
    if (res.success) {
      fetchUsers();
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!isManager) return;
    const res = await userApi.updateUserRole(userId, newRole);
    if (res.success) {
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            User Accounts & Roles
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Role-based authorization control: Facility Managers, Inspectors, and Maintenance Technicians
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Full Name / Email</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3">Created Date</th>
                <th className="p-3 text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ivory/50">
                  <td className="p-3">
                    <span className="font-semibold text-charcoal block">{u.fullName}</span>
                    <span className="text-muted text-[11px]">{u.email}</span>
                  </td>
                  <td className="p-3">
                    {isManager && u.id !== currentUser?.id ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="text-xs px-2 py-1 rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
                      >
                        <option value="FACILITY_MANAGER">Facility Manager</option>
                        <option value="INSPECTOR">Inspector</option>
                        <option value="MAINTENANCE_TECHNICIAN">Technician</option>
                      </select>
                    ) : (
                      <Badge variant="sand" size="sm">
                        {u.role.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                  </td>
                  <td className="p-3 tabular-nums text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    {isManager && u.id !== currentUser?.id && (
                      <Button
                        size="sm"
                        variant={u.isActive ? 'danger' : 'secondary'}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
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
