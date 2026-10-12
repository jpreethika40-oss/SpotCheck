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
    totalInspections?: number;
    completedInspections?: number;
    draftInspections?: number;
    completionRate?: number;
    totalIssues?: number;
    openIssues?: number;
    verifiedIssues?: number;
  };
  inspectionsByMonth?: Array<{ month: string; completed: number; total: number }>;
  issuesByCategory?: Array<{ name?: string; category?: string; count: number }>;
  issuesBySeverity?: Array<{ severity: string; count: number }>;
  issuesByFacility?: Array<{ facilityName: string; count: number }>;
  issuesByStatus?: Array<{ status: string; count: number }>;
  frequentFailures?: Array<{ checkpointName: string; checkpointCode?: string; facilityName?: string; failureCount: number }>;
  repeatCheckpoints?: Array<{ checkpointName: string; checkpointCode?: string; facilityName?: string; failureCount: number }>;
  recentActivity?: Array<{ id: string; action: string; timestamp: string; actorName: string; details?: any }>;
  recentInspections?: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    facility: { name: string };
    inspector: { fullName: string };
  }>;
  recentWorkOrders?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    version?: number;
    createdAt: string;
    facility: { name: string };
  }>;
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
