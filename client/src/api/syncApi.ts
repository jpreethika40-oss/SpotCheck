import { api, ApiResponse } from './client';

export interface ConflictRecord {
  id: string;
  recordId: string;
  entityType: string;
  actorId: string;
  baseVersion: number;
  serverVersion: number;
  clientVersion: number;
  conflictingFields: string[];
  resolvedStrategy?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  status: 'OPEN' | 'RESOLVED';
  payloadLocal: any;
  payloadServer: any;
  createdAt: string;
}

export interface SyncDiagnosticsData {
  totalProcessed: number;
  openConflictsCount: number;
  statusSummary: Record<string, number>;
  recentOperations: any[];
}

export const syncApi = {
  syncBatch: (operations: any[]): Promise<ApiResponse<any>> => {
    return api.post('/sync', { operations });
  },

  getDiagnostics: (): Promise<ApiResponse<SyncDiagnosticsData>> => {
    return api.get('/sync/diagnostics');
  },

  getConflicts: (params?: { status?: string }): Promise<ApiResponse<ConflictRecord[]>> => {
    return api.get('/sync/conflicts', params);
  },

  resolveConflict: (conflictId: string, payload: {
    resolutionStrategy: 'ACCEPT_SERVER' | 'FORCE_CLIENT' | 'MANUAL_MERGE';
    mergedPayload?: any;
    resolutionNotes?: string;
  }): Promise<ApiResponse<any>> => {
    return api.post(`/sync/conflicts/${conflictId}/resolve`, payload);
  },
};
