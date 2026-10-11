import Dexie, { Table } from 'dexie';

export interface OfflineInspection {
  id: string; // Client UUID
  templateId: string;
  templateVersion: number;
  facilityId: string;
  zoneId?: string | null;
  checkpointId?: string | null;
  assetId?: string | null;
  inspectorId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED' | 'FLAGGED';
  startedAt: string;
  completedAt?: string | null;
  summaryNotes?: string;
  weatherCondition?: string;
  items: any[];
  version: number;
  syncStatus: 'DRAFT' | 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface OfflineIssue {
  id: string;
  facilityId: string;
  zoneId?: string | null;
  checkpointId?: string | null;
  assetId?: string | null;
  inspectionId?: string | null;
  title: string;
  description: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reportedById: string;
  status: 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED';
  assignedToId?: string | null;
  dueDate?: string | null;
  evidenceAttachmentIds: string[];
  workAttachmentIds: string[];
  version: number;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface OfflineOutboxOperation {
  operationId: string; // UUID
  idempotencyKey: string;
  entityType: 'INSPECTION' | 'ISSUE' | 'WORK_ORDER';
  action: 'CREATE' | 'UPDATE' | 'TRANSITION_STATUS';
  recordId: string;
  baseVersion: number;
  payload: any;
  clientTimestamp: string;
  status: 'QUEUED' | 'IN_FLIGHT' | 'COMPLETED' | 'CONFLICT' | 'REJECTED' | 'FAILED';
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface OfflineUploadItem {
  id: string; // Attachment UUID
  associatedType: 'INSPECTION' | 'ISSUE' | 'WORK_ORDER_EVENT';
  associatedId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  blob: Blob;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  totalChunks: number;
  uploadedChunks: number;
  checksumSha256?: string;
  storageUrl?: string;
  createdAt: string;
}

export class SpotCheckDatabase extends Dexie {
  offlineInspections!: Table<OfflineInspection, string>;
  offlineIssues!: Table<OfflineIssue, string>;
  offlineOutbox!: Table<OfflineOutboxOperation, string>;
  offlineUploads!: Table<OfflineUploadItem, string>;
  cachedFacilities!: Table<any, string>;
  cachedTemplates!: Table<any, string>;
  cachedCheckpoints!: Table<any, string>;
  cachedWorkOrders!: Table<any, string>;

  constructor() {
    super('SpotCheckOfflineDB');
    this.version(1).stores({
      offlineInspections: 'id, facilityId, templateId, status, syncStatus, updatedAt',
      offlineIssues: 'id, facilityId, status, syncStatus, updatedAt',
      offlineOutbox: 'operationId, idempotencyKey, entityType, action, recordId, status, clientTimestamp',
      offlineUploads: 'id, associatedType, associatedId, uploadStatus, createdAt',
      cachedFacilities: 'id, code, name',
      cachedTemplates: 'id, version, isLatest',
      cachedCheckpoints: 'id, facilityId, zoneId, qrCodeToken',
      cachedWorkOrders: 'id, facilityId, status, severity, assignedToId',
    });
  }
}

export const db = new SpotCheckDatabase();
