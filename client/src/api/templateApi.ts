import { api, ApiResponse } from './client';
import { InspectionTemplate } from '@spotcheck/shared';

export interface InspectionSchedule {
  id: string;
  facilityId: string;
  templateId: string;
  assignedToId?: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  nextDueDate: string;
  lastRunDate?: string | null;
  isActive: boolean;
  facility?: { id: string; name: string; code: string };
  template?: { id: string; name: string; version: number };
  assignedTo?: { id: string; fullName: string; email: string };
}

export const templateApi = {
  getTemplates: (params?: { facilityType?: string; onlyLatest?: string; isActive?: string }): Promise<ApiResponse<InspectionTemplate[]>> => {
    return api.get('/templates', params);
  },

  getTemplateById: (id: string): Promise<ApiResponse<InspectionTemplate>> => {
    return api.get(`/templates/${id}`);
  },

  createTemplate: (data: Partial<InspectionTemplate>): Promise<ApiResponse<InspectionTemplate>> => {
    return api.post('/templates', data);
  },

  updateTemplate: (id: string, data: Partial<InspectionTemplate>): Promise<ApiResponse<InspectionTemplate>> => {
    return api.put(`/templates/${id}`, data);
  },

  getSchedules: (params?: { facilityId?: string }): Promise<ApiResponse<InspectionSchedule[]>> => {
    return api.get('/templates/schedules/all', params);
  },
};
