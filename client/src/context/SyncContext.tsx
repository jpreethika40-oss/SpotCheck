import React, { createContext, useContext, useState, useEffect } from 'react';
import { syncManager } from '../offline/syncManager';
import { uploadQueue } from '../offline/uploadQueue';
import { syncApi } from '../api/syncApi';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingUploadsCount: number;
  openConflictsCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
  simulateOffline: boolean;
  setSimulateOffline: (val: boolean) => void;
  refreshCounts: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingUploadsCount, setPendingUploadsCount] = useState<number>(0);
  const [openConflictsCount, setOpenConflictsCount] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const effectiveOnline = browserOnline && !simulateOffline;

  const refreshCounts = async () => {
    try {
      const pCount = await syncManager.getPendingCount();
      setPendingCount(pCount);

      const pendingUploads = await uploadQueue.getPendingUploads();
      setPendingUploadsCount(pendingUploads.length);

      if (effectiveOnline) {
        const diag = await syncApi.getDiagnostics();
        if (diag.success && diag.data) {
          setOpenConflictsCount(diag.data.openConflictsCount || 0);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to syncManager
    const unsubSync = syncManager.subscribe((status) => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
      if (status.lastSyncAt) setLastSyncAt(status.lastSyncAt);
      if (status.lastError) setLastError(status.lastError);
    });

    // Subscribe to uploadQueue
    const unsubUpload = uploadQueue.subscribe((status) => {
      setPendingUploadsCount(status.pendingCount);
    });

    refreshCounts();
    const interval = setInterval(refreshCounts, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
      unsubUpload();
      clearInterval(interval);
    };
  }, [effectiveOnline]);

  const syncNow = async () => {
    if (!effectiveOnline) {
      setLastError('Cannot sync while in offline mode.');
      return;
    }
    await syncManager.processOutbox();
    await uploadQueue.processQueue();
    await refreshCounts();
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline: effectiveOnline,
        isSyncing,
        pendingCount,
        pendingUploadsCount,
        openConflictsCount,
        lastSyncAt,
        lastError,
        syncNow,
        simulateOffline,
        setSimulateOffline,
        refreshCounts,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
};
