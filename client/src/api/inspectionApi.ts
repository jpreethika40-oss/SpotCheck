import { api, ApiResponse } from './client';
import { InspectionRecord } from '@spotcheck/shared';

export const inspectionApi = {
  getInspections: (params?: {
    facilityId?: string;
    status?: string;
    inspectorId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<InspectionRecord[]>> => {
    return api.get('/inspections', params);
  },

  getInspectionById: (id: string): Promise<ApiResponse<InspectionRecord>> => {
    return api.get(`/inspections/${id}`);
  },

  submitInspection: (data: any): Promise<ApiResponse<{ inspection: InspectionRecord; createdIssues: any[] }>> => {
    return api.post('/inspections', data);
  },

  downloadInspectionPdf: async (id: string): Promise<Blob | null> => {
    const res = await api.get(`/inspections/${id}/pdf`);
    if (res.success && res.data) {
      return res.data as Blob;
    }
    return null;
  },
};
