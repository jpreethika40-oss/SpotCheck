import { api, ApiResponse } from './client';
import { Facility, Zone, Checkpoint, Asset } from '@spotcheck/shared';

export const facilityApi = {
  getFacilities: (params?: { search?: string; type?: string }): Promise<ApiResponse<Facility[]>> => {
    return api.get('/facilities', params);
  },

  getFacilityById: (id: string): Promise<ApiResponse<Facility>> => {
    return api.get(`/facilities/${id}`);
  },

  createFacility: (data: Partial<Facility>): Promise<ApiResponse<Facility>> => {
    return api.post('/facilities', data);
  },

  updateFacility: (id: string, data: Partial<Facility>): Promise<ApiResponse<Facility>> => {
    return api.put(`/facilities/${id}`, data);
  },

  // Zones
  getZones: (facilityId: string): Promise<ApiResponse<Zone[]>> => {
    return api.get(`/facilities/${facilityId}/zones`);
  },

  createZone: (facilityId: string, data: Partial<Zone>): Promise<ApiResponse<Zone>> => {
    return api.post(`/facilities/${facilityId}/zones`, data);
  },

  // Checkpoints
  getCheckpoints: (params?: { facilityId?: string; zoneId?: string }): Promise<ApiResponse<Checkpoint[]>> => {
    return api.get('/checkpoints', params);
  },

  getCheckpointByToken: (token: string): Promise<ApiResponse<Checkpoint>> => {
    return api.get(`/checkpoints/by-token/${token}`);
  },

  createCheckpoint: (data: Partial<Checkpoint>): Promise<ApiResponse<Checkpoint>> => {
    return api.post('/checkpoints', data);
  },

  // Assets
  getAssets: (params?: { facilityId?: string; category?: string; status?: string }): Promise<ApiResponse<Asset[]>> => {
    return api.get('/facilities/assets/all', params);
  },

  getAssetById: (id: string): Promise<ApiResponse<Asset>> => {
    return api.get(`/facilities/assets/${id}`);
  },

  createAsset: (data: Partial<Asset>): Promise<ApiResponse<Asset>> => {
    return api.post('/facilities/assets', data);
  },

  updateAsset: (id: string, data: Partial<Asset>): Promise<ApiResponse<Asset>> => {
    return api.put(`/facilities/assets/${id}`, data);
  },
};
