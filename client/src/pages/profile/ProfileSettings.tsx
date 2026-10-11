import React, { useState, useEffect } from 'react';
import { User, KeyRound, Database, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { db } from '../../offline/db';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const [cacheStats, setCacheStats] = useState({
    inspections: 0,
    outbox: 0,
    uploads: 0,
  });

  const loadCacheStats = async () => {
    try {
      const [insp, out, upl] = await Promise.all([
        db.offlineInspections.count(),
        db.offlineOutbox.count(),
        db.offlineUploads.count(),
      ]);
      setCacheStats({ inspections: insp, outbox: out, uploads: upl });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCacheStats();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    setSubmittingPassword(true);

    try {
      const res = await authApi.changePassword({ currentPassword, newPassword });
      if (res.success) {
        setPasswordStatus({ success: true, message: 'Password updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordStatus({ success: false, message: res.error?.message || 'Password update failed.' });
      }
    } catch (err: any) {
      setPasswordStatus({ success: false, message: err.message || 'Error updating password.' });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all local offline drafts and cache from this browser?')) {
      await db.offlineInspections.clear();
      await db.offlineOutbox.clear();
      await db.offlineUploads.clear();
      await loadCacheStats();
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-warm pb-4">
        <h1 className="text-xl font-bold tracking-tight text-charcoal">
          Profile & Application Settings
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Account credentials, role assignments, and client-side offline storage management
        </p>
      </div>

      {/* Account Info */}
      <Card title="Account Overview">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted block text-[11px] uppercase">Full Name</span>
            <span className="font-bold text-charcoal text-sm">{user?.fullName}</span>
          </div>
          <div>
            <span className="text-muted block text-[11px] uppercase">Email Address</span>
            <span className="font-semibold text-charcoal">{user?.email}</span>
          </div>
          <div>
            <span className="text-muted block text-[11px] uppercase">Assigned System Role</span>
            <div className="mt-1">
              <Badge variant="sand">{user?.role?.replace(/_/g, ' ')}</Badge>
            </div>
          </div>
          <div>
            <span className="text-muted block text-[11px] uppercase">Account Created</span>
            <span className="text-charcoal">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>
      </Card>

      {/* Change Password Form */}
      <Card title="Update Security Credentials">
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordStatus && (
            <div
              className={`p-3 rounded text-xs font-semibold flex items-center gap-2 ${
                passwordStatus.success
                  ? 'bg-sage-bg border border-[#D5DDD5] text-sage'
                  : 'bg-crimson-bg border border-[#F2D6D3] text-crimson'
              }`}
            >
              {passwordStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{passwordStatus.message}</span>
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Must be at least 8 characters long."
          />

          <Button type="submit" variant="primary" size="sm" loading={submittingPassword}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* IndexedDB Client Storage Management */}
      <Card title="Offline Client Storage Diagnostics" subtitle="Local IndexedDB tables in this browser instance">
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-sand-light/40 border border-warm rounded">
              <span className="text-[10px] text-muted uppercase font-bold block">Draft Inspections</span>
              <span className="text-lg font-bold text-charcoal tabular-nums">{cacheStats.inspections}</span>
            </div>
            <div className="p-3 bg-sand-light/40 border border-warm rounded">
              <span className="text-[10px] text-muted uppercase font-bold block">Outbox Operations</span>
              <span className="text-lg font-bold text-charcoal tabular-nums">{cacheStats.outbox}</span>
            </div>
            <div className="p-3 bg-sand-light/40 border border-warm rounded">
              <span className="text-[10px] text-muted uppercase font-bold block">Pending Photos</span>
              <span className="text-lg font-bold text-charcoal tabular-nums">{cacheStats.uploads}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-warm">
            <span className="text-muted">
              Clear browser offline storage if needed for clean local state.
            </span>
            <Button
              size="sm"
              variant="outline"
              icon={<Trash2 className="w-4 h-4 text-crimson" />}
              onClick={handleClearCache}
            >
              Clear Local Offline Storage
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
