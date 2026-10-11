import React, { useState } from 'react';
import {
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const {
    isOnline,
    isSyncing,
    pendingCount,
    pendingUploadsCount,
    syncNow,
    simulateOffline,
    setSimulateOffline,
    lastSyncAt,
  } = useSync();

  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-surface border-b border-warm px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-subtle">
      {/* Left: Mobile hamburger & branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-charcoal hover:bg-ivory lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-charcoal tracking-tight">Facility Inspection Platform</span>
          <span className="text-xs text-muted ml-2">v1.0.0-prod</span>
        </div>
      </div>

      {/* Right: Sync state controls, notifications, user tag */}
      <div className="flex items-center gap-3">
        {/* Simulate Offline toggle for testers */}
        <button
          onClick={() => setSimulateOffline(!simulateOffline)}
          title="Toggle simulated offline mode for field testing"
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
            simulateOffline
              ? 'bg-amber-bg border-amber text-amber font-medium'
              : 'bg-ivory border-warm text-muted hover:text-charcoal'
          }`}
        >
          {simulateOffline ? (
            <>
              <ToggleRight className="w-4 h-4 text-amber" />
              <span>Simulated Offline</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              <span className="hidden md:inline">Simulate Offline</span>
            </>
          )}
        </button>

        {/* Real Network & Sync Status Indicator */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sage-bg border border-[#D5DDD5] rounded text-sage text-xs font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-crimson-bg border border-[#F2D6D3] rounded text-crimson text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode</span>
            </div>
          )}

          {/* Sync Trigger button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncNow()}
            loading={isSyncing}
            disabled={!isOnline}
            title={
              lastSyncAt
                ? `Last synced: ${lastSyncAt.toLocaleTimeString()}`
                : 'Synchronize local outbox'
            }
            className="text-xs font-medium relative"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sync</span>
            {(pendingCount > 0 || pendingUploadsCount > 0) && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-terracotta text-white rounded-full font-bold tabular-nums">
                {pendingCount + pendingUploadsCount}
              </span>
            )}
          </Button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-charcoal hover:bg-ivory rounded-full relative transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-warm rounded-md shadow-card p-3 z-50 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-warm mb-2">
                <span className="text-xs font-bold text-charcoal">Notifications</span>
                <span className="text-[11px] text-muted">Up to date</span>
              </div>
              <div className="text-xs text-muted text-center py-4">
                No unread alerts or notifications.
              </div>
            </div>
          )}
        </div>

        {/* Role badge */}
        <div className="hidden lg:block border-l border-warm pl-3">
          <Badge variant="sand" size="sm">
            {user?.role?.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>
    </header>
  );
};
