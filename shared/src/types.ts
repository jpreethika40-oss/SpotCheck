export type UserRole = 'FACILITY_MANAGER' | 'INSPECTOR' | 'MAINTENANCE_TECHNICIAN';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string | null;
  facilityIds?: string[];
  createdAt: string;
}

export type FacilityType = 'COMMERCIAL' | 'INDUSTRIAL' | 'HEALTHCARE' | 'EDUCATIONAL' | 'RESIDENTIAL' | 'WAREHOUSE';

export interface Facility {
  id: string;
  name: string;
  code: string;
  type: FacilityType;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  squareMeters?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    zones?: number;
    assets?: number;
    inspections?: number;
    issues?: number;
  };
}

export interface Zone {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  floor?: string;
  description?: string;
  facilityName?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    checkpoints?: number;
    assets?: number;
  };
}

export interface Checkpoint {
  id: string;
  zoneId: string;
  facilityId: string;
  name: string;
  code: string;
  qrCodeToken: string;
  locationDescription?: string;
  instructions?: string;
  sequenceOrder: number;
  isActive: boolean;
  zoneName?: string;
  facilityName?: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetCategory = 'HVAC' | 'ELECTRICAL' | 'PLUMBING' | 'FIRE_SAFETY' | 'STRUCTURAL' | 'ELEVATOR' | 'SECURITY' | 'OTHER';
export type AssetStatus = 'OPERATIONAL' | 'NEEDS_ATTENTION' | 'OUT_OF_SERVICE' | 'DECOMMISSIONED';

export interface Asset {
  id: string;
  facilityId: string;
  zoneId?: string | null;
  checkpointId?: string | null;
  name: string;
  assetTag: string;
  category: AssetCategory;
  modelNumber?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  installationDate?: string | null;
  lastInspectionDate?: string | null;
  status: AssetStatus;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  updatedAt: string;
}

export type FieldType = 'PASS_FAIL' | 'NUMERIC' | 'TEXT' | 'SINGLE_CHOICE' | 'CHECKBOX' | 'PHOTO_EVIDENCE';

export interface TemplateFieldCondition {
  dependsOnFieldId: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
  value: string | number | boolean;
}

export interface TemplateFieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  instructions?: string;
  minNumeric?: number;
  maxNumeric?: number;
  unit?: string;
  options?: string[]; // For single-choice
  isCriticalFailure: boolean; // If failed or out of range, auto-triggers issue
  failureDefectSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  failureDefectCategory?: string;
  requireEvidenceOnFailure?: boolean;
  condition?: TemplateFieldCondition;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  description?: string;
  facilityType?: FacilityType;
  version: number;
  isLatest: boolean;
  isActive: boolean;
  fields: TemplateFieldDef[];
  createdAt: string;
  updatedAt: string;
}

export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED' | 'FLAGGED';
export type ItemResult = 'PASS' | 'FAIL' | 'NA';

export interface InspectionResponseItem {
  fieldId: string;
  key: string;
  label: string;
  result?: ItemResult;
  numericValue?: number;
  textValue?: string;
  selectedOption?: string;
  checkboxValues?: string[];
  notes?: string;
  attachmentIds: string[];
  isFlaggedDefect?: boolean;
  failedReason?: string;
}

export interface InspectionRecord {
  id: string; // Stable UUID
  templateId: string;
  templateVersion: number;
  facilityId: string;
  zoneId?: string | null;
  checkpointId?: string | null;
  assetId?: string | null;
  inspectorId: string;
  status: InspectionStatus;
  startedAt: string;
  completedAt?: string | null;
  summaryNotes?: string;
  weatherCondition?: string;
  items: InspectionResponseItem[];
  version: number; // Concurrency token
  syncStatus?: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  // Joins
  facilityName?: string;
  zoneName?: string;
  checkpointName?: string;
  inspectorName?: string;
  templateName?: string;
}

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type WorkOrderStatus = 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED';

export const WORK_ORDER_STATE_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  REPORTED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'REPORTED'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['VERIFIED', 'IN_PROGRESS'], // If rejected at verification, returns to IN_PROGRESS
  VERIFIED: [], // Terminal verified state
};

export interface Issue {
  id: string;
  facilityId: string;
  zoneId?: string | null;
  checkpointId?: string | null;
  assetId?: string | null;
  inspectionId?: string | null;
  title: string;
  description: string;
  category: string;
  severity: IssueSeverity;
  reportedById: string;
  status: WorkOrderStatus;
  assignedToId?: string | null;
  dueDate?: string | null;
  resolutionNotes?: string | null;
  verificationNotes?: string | null;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  evidenceAttachmentIds: string[];
  workAttachmentIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  // Joins
  facilityName?: string;
  zoneName?: string;
  assetName?: string;
  reportedByName?: string;
  assignedToName?: string;
  verifiedByName?: string;
}

export interface WorkOrderEvent {
  id: string;
  issueId: string;
  actorId: string;
  actorName: string;
  fromStatus: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  notes?: string;
  evidenceAttachmentIds?: string[];
  createdAt: string;
}

export interface AttachmentMetadata {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  uploadedChunks?: number;
  totalChunks?: number;
  storageUrl?: string;
  uploaderId: string;
  associatedType: 'INSPECTION' | 'ISSUE' | 'WORK_ORDER_EVENT';
  associatedId: string;
  createdAt: string;
}

export interface SyncOperation {
  operationId: string;
  idempotencyKey: string;
  entityType: 'INSPECTION' | 'ISSUE' | 'WORK_ORDER';
  action: 'CREATE' | 'UPDATE' | 'TRANSITION_STATUS';
  recordId: string;
  baseVersion: number;
  payload: any;
  clientTimestamp: string;
}

export interface SyncOperationResult {
  operationId: string;
  idempotencyKey: string;
  success: boolean;
  status: 'APPLIED' | 'CONFLICT' | 'REJECTED' | 'ALREADY_PROCESSED';
  newVersion?: number;
  serverRecord?: any;
  conflictDetails?: ConflictDetails;
  errorMessage?: string;
}

export interface ConflictDetails {
  recordId: string;
  entityType: string;
  baseVersion: number;
  serverVersion: number;
  localVersion: number;
  conflictingFields: string[];
  autoMergedFields: string[];
  localChanges: Record<string, any>;
  serverChanges: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  facilityId?: string;
  previousVersion?: number;
  newVersion?: number;
  details: Record<string, any>;
  ipAddress?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'ASSIGNMENT' | 'OVERDUE' | 'STATUS_CHANGE' | 'CONFLICT' | 'INSPECTION_SUBMITTED';
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}
