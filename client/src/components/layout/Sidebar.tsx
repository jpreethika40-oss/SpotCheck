import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  QrCode,
  Calendar,
  AlertTriangle,
  Building2,
  Box,
  FileSpreadsheet,
  GitMerge,
  Activity,
  History,
  BarChart3,
  Users,
  UserCheck,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout, isManager, isInspector, isTechnician } = useAuth();
  const { pendingCount, openConflictsCount } = useSync();

  const navItems = [
    {
      group: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN'] },
      ],
    },
    {
      group: 'INSPECTIONS',
      items: [
        { label: 'Inspections', path: '/inspections', icon: ClipboardCheck, roles: ['FACILITY_MANAGER', 'INSPECTOR'] },
        { label: 'New Inspection', path: '/inspections/new', icon: ClipboardCheck, roles: ['FACILITY_MANAGER', 'INSPECTOR'] },
        { label: 'QR Scan Checkpoint', path: '/checkpoints/scan', icon: QrCode, roles: ['FACILITY_MANAGER', 'INSPECTOR'] },
        { label: 'Schedules', path: '/schedules', icon: Calendar, roles: ['FACILITY_MANAGER'] },
      ],
    },
    {
      group: 'MAINTENANCE',
      items: [
        { label: 'Work Orders & Issues', path: '/work-orders', icon: AlertTriangle, roles: ['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN'] },
      ],
    },
    {
      group: 'FACILITIES & ASSETS',
      items: [
        { label: 'Facilities & Zones', path: '/facilities', icon: Building2, roles: ['FACILITY_MANAGER', 'INSPECTOR'] },
        { label: 'Assets', path: '/assets', icon: Box, roles: ['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN'] },
        { label: 'Template Builder', path: '/templates', icon: FileSpreadsheet, roles: ['FACILITY_MANAGER'] },
      ],
    },
    {
      group: 'RELIABILITY & DATA',
      items: [
        {
          label: 'Conflict Review',
          path: '/conflicts',
          icon: GitMerge,
          roles: ['FACILITY_MANAGER'],
          badge: openConflictsCount > 0 ? openConflictsCount : undefined,
          badgeColor: 'bg-crimson text-white',
        },
        {
          label: 'Sync Diagnostics',
          path: '/sync-diagnostics',
          icon: Activity,
          roles: ['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN'],
          badge: pendingCount > 0 ? pendingCount : undefined,
          badgeColor: 'bg-amber text-charcoal font-bold',
        },
        { label: 'Audit History', path: '/audit', icon: History, roles: ['FACILITY_MANAGER'] },
        { label: 'Analytics & Reports', path: '/analytics', icon: BarChart3, roles: ['FACILITY_MANAGER'] },
      ],
    },
    {
      group: 'ADMINISTRATION',
      items: [
        { label: 'User Directory', path: '/users', icon: Users, roles: ['FACILITY_MANAGER'] },
        { label: 'Profile & Settings', path: '/profile', icon: UserCheck, roles: ['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN'] },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-charcoal-nav text-ivory flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#3D3C35] gap-3">
          <div className="w-8 h-8 rounded bg-terracotta flex items-center justify-center font-bold text-white shadow-subtle">
            SC
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">SpotCheck</h1>
            <p className="text-[10px] text-muted tracking-wide uppercase">Offline Facility Ops</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navItems.map((group) => {
            const visibleItems = group.items.filter((item) =>
              item.roles.includes(user?.role || '')
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.group} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold tracking-wider text-muted uppercase mb-1">
                  {group.group}
                </p>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => onClose()}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors ${
                          isActive
                            ? 'bg-terracotta text-white font-semibold'
                            : 'text-[#DED2C0] hover:bg-[#3D3C35] hover:text-white'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Current user & Logout footer */}
        <div className="p-4 border-t border-[#3D3C35] bg-[#2A2925]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-sand/20 border border-sand/40 flex items-center justify-center text-xs font-semibold text-ivory">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted">
                  <Shield className="w-3 h-3 text-terracotta" />
                  <span className="truncate">{user?.role?.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-[#DED2C0] hover:text-white hover:bg-[#3D3C35] rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
