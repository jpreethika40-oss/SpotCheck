import { api, ApiResponse } from './client';
import { Issue, WorkOrderStatus, IssueSeverity } from '@spotcheck/shared';

export interface TransitionPayload {
  toStatus: WorkOrderStatus;
  currentVersion: number;
  notes?: string;
  resolutionNotes?: string;
  verificationNotes?: string;
  workAttachmentIds?: string[];
  rejectionReason?: string;
}

export const workOrderApi = {
  getWorkOrders: (params?: {
    facilityId?: string;
    status?: string;
    severity?: string;
    assignedToId?: string;
    search?: string;
    isOverdue?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Issue[]>> => {
    return api.get('/work-orders', params);
  },

  getWorkOrderById: (id: string): Promise<ApiResponse<Issue>> => {
    return api.get(`/work-orders/${id}`);
  },

  createWorkOrder: (data: any): Promise<ApiResponse<Issue>> => {
    return api.post('/work-orders', data);
  },

  transitionStatus: (id: string, payload: TransitionPayload): Promise<ApiResponse<Issue>> => {
    return api.post(`/work-orders/${id}/transition`, payload);
  },
};
