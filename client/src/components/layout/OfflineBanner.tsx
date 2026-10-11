import React from 'react';
import { WifiOff, AlertTriangle, RefreshCw, UploadCloud } from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { Button } from '../common/Button';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount, pendingUploadsCount, isSyncing, syncNow, lastError } = useSync();

  if (isOnline && pendingCount === 0 && pendingUploadsCount === 0 && !lastError) {
    return null;
  }

  return (
    <div className="w-full bg-[#FCFAF6] border-b border-warm px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-charcoal">
        {!isOnline ? (
          <>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-crimson-bg text-crimson">
              <WifiOff className="w-3 h-3" />
            </span>
            <span className="font-semibold text-crimson">Offline Mode:</span>
            <span>You can continue conducting inspections and updating tasks. All data is saved safely in local storage.</span>
          </>
        ) : lastError ? (
          <>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-bg text-amber">
              <AlertTriangle className="w-3 h-3" />
            </span>
            <span className="font-semibold text-amber">Sync Notice:</span>
            <span>{lastError}</span>
          </>
        ) : (
          <>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sand text-charcoal">
              <UploadCloud className="w-3 h-3" />
            </span>
            <span className="font-semibold">Local Outbox:</span>
            <span>
              {pendingCount} operation{pendingCount === 1 ? '' : 's'} and {pendingUploadsCount} photo{pendingUploadsCount === 1 ? '' : 's'} queued for synchronization.
            </span>
          </>
        )}
      </div>

      {isOnline && (pendingCount > 0 || pendingUploadsCount > 0) && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncNow()}
            loading={isSyncing}
            className="text-xs py-1 h-7"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Now ({pendingCount + pendingUploadsCount})</span>
          </Button>
        </div>
      )}
    </div>
  );
};
