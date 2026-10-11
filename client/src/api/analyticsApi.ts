import { api, ApiResponse } from './client';

export interface AnalyticsDashboardData {
  metrics: {
    inspectionsCompletedMonth: number;
    inspectionsDuePending: number;
    inspectionsOverdue: number;
    inspectionsCompletionRate: number;
    openWorkOrders: number;
    criticalWorkOrders: number;
    overdueWorkOrders: number;
    avgResolutionTimeHours: number;
    syncPendingOffline: number;
    syncConflictsOpen: number;
  };
  inspectionsByMonth: Array<{ month: string; completed: number; total: number }>;
  issuesByCategory: Array<{ category: string; count: number }>;
  issuesBySeverity: Array<{ severity: string; count: number }>;
  issuesByFacility: Array<{ facilityName: string; count: number }>;
  frequentFailures: Array<{ checkpointName: string; facilityName: string; failureCount: number }>;
  recentActivity: Array<{ id: string; action: string; timestamp: string; actorName: string; details: any }>;
}

export const analyticsApi = {
  getDashboardData: (params?: { facilityId?: string; timeRange?: string }): Promise<ApiResponse<AnalyticsDashboardData>> => {
    return api.get('/analytics/dashboard', params);
  },
};

export const reportApi = {
  exportInspectionsCsv: async (facilityId?: string): Promise<Blob | null> => {
    const res = await api.get('/reports/inspections/csv', facilityId ? { facilityId } : undefined);
    if (res.success && res.data) {
      return res.data as Blob;
    }
    return null;
  },

  exportWorkOrdersCsv: async (facilityId?: string): Promise<Blob | null> => {
    const res = await api.get('/reports/work-orders/csv', facilityId ? { facilityId } : undefined);
    if (res.success && res.data) {
      return res.data as Blob;
    }
    return null;
  },
};
