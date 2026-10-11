import { z } from 'zod';

export const UserRoleSchema = z.enum(['FACILITY_MANAGER', 'INSPECTOR', 'MAINTENANCE_TECHNICIAN']);

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  avatarUrl: z.string().url().optional().nullable(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: UserRoleSchema,
  facilityIds: z.array(z.string().uuid()).optional(),
});

export const FacilitySchema = z.object({
  name: z.string().min(2, 'Facility name must be at least 2 characters'),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric with dashes or underscores'),
  type: z.enum(['COMMERCIAL', 'INDUSTRIAL', 'HEALTHCARE', 'EDUCATIONAL', 'RESIDENTIAL', 'WAREHOUSE']),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  squareMeters: z.number().positive().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const ZoneSchema = z.object({
  facilityId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(1).max(20),
  floor: z.string().optional(),
  description: z.string().optional(),
});

export const CheckpointSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(1).max(30),
  locationDescription: z.string().optional(),
  instructions: z.string().optional(),
  sequenceOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const AssetSchema = z.object({
  facilityId: z.string().uuid(),
  zoneId: z.string().uuid().optional().nullable(),
  checkpointId: z.string().uuid().optional().nullable(),
  name: z.string().min(2),
  assetTag: z.string().min(2).max(50),
  category: z.enum(['HVAC', 'ELECTRICAL', 'PLUMBING', 'FIRE_SAFETY', 'STRUCTURAL', 'ELEVATOR', 'SECURITY', 'OTHER']),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  installationDate: z.string().optional().nullable(),
  status: z.enum(['OPERATIONAL', 'NEEDS_ATTENTION', 'OUT_OF_SERVICE', 'DECOMMISSIONED']).default('OPERATIONAL'),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export const TemplateFieldDefSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['PASS_FAIL', 'NUMERIC', 'TEXT', 'SINGLE_CHOICE', 'CHECKBOX', 'PHOTO_EVIDENCE']),
  required: z.boolean().default(false),
  instructions: z.string().optional(),
  minNumeric: z.number().optional(),
  maxNumeric: z.number().optional(),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  isCriticalFailure: z.boolean().default(false),
  failureDefectSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  failureDefectCategory: z.string().optional(),
  requireEvidenceOnFailure: z.boolean().default(false),
  condition: z.object({
    dependsOnFieldId: z.string(),
    operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN']),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }).optional(),
});

export const InspectionTemplateSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  facilityType: z.enum(['COMMERCIAL', 'INDUSTRIAL', 'HEALTHCARE', 'EDUCATIONAL', 'RESIDENTIAL', 'WAREHOUSE']).optional(),
  fields: z.array(TemplateFieldDefSchema).min(1, 'Template must have at least one field'),
  isActive: z.boolean().default(true),
});

export const InspectionResponseItemSchema = z.object({
  fieldId: z.string(),
  key: z.string(),
  label: z.string(),
  result: z.enum(['PASS', 'FAIL', 'NA']).optional(),
  numericValue: z.number().optional(),
  textValue: z.string().optional(),
  selectedOption: z.string().optional(),
  checkboxValues: z.array(z.string()).optional(),
  notes: z.string().optional(),
  attachmentIds: z.array(z.string()).default([]),
  isFlaggedDefect: z.boolean().default(false),
  failedReason: z.string().optional(),
});

export const SubmitInspectionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  facilityId: z.string().uuid(),
  zoneId: z.string().uuid().optional().nullable(),
  checkpointId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'SUBMITTED']),
  startedAt: z.string(),
  completedAt: z.string().optional().nullable(),
  summaryNotes: z.string().optional(),
  weatherCondition: z.string().optional(),
  items: z.array(InspectionResponseItemSchema),
  version: z.number().int().default(1),
  idempotencyKey: z.string().optional(),
});

export const CreateIssueSchema = z.object({
  id: z.string().uuid().optional(),
  facilityId: z.string().uuid(),
  zoneId: z.string().uuid().optional().nullable(),
  checkpointId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  inspectionId: z.string().uuid().optional().nullable(),
  title: z.string().min(3),
  description: z.string().min(5),
  category: z.string().min(2),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  assignedToId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  evidenceAttachmentIds: z.array(z.string()).default([]),
});

export const TransitionWorkOrderSchema = z.object({
  targetStatus: z.enum(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED']),
  notes: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  workAttachmentIds: z.array(z.string()).optional(),
  resolutionNotes: z.string().optional(),
  verificationNotes: z.string().optional(),
  currentVersion: z.number().int(),
});

export const SyncBatchSchema = z.object({
  operations: z.array(z.object({
    operationId: z.string().uuid(),
    idempotencyKey: z.string(),
    entityType: z.enum(['INSPECTION', 'ISSUE', 'WORK_ORDER']),
    action: z.enum(['CREATE', 'UPDATE', 'TRANSITION_STATUS']),
    recordId: z.string().uuid(),
    baseVersion: z.number().int(),
    payload: z.record(z.any()),
    clientTimestamp: z.string(),
  })).max(50),
});

export const ConflictResolveSchema = z.object({
  conflictId: z.string().uuid(),
  recordId: z.string().uuid(),
  entityType: z.enum(['INSPECTION', 'ISSUE', 'WORK_ORDER']),
  resolutionStrategy: z.enum(['USE_LOCAL', 'USE_SERVER', 'CUSTOM_MERGE']),
  resolvedPayload: z.record(z.any()),
  serverVersion: z.number().int(),
});
