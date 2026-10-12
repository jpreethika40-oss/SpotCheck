import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Check,
  X,
  Minus,
  Camera,
  Image,
  AlertTriangle,
  Save,
  ArrowRight,
  ArrowLeft,
  Building,
  Layers,
  QrCode,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { InspectionTemplate, Facility, Zone, Checkpoint, Asset } from '@spotcheck/shared';
import { facilityApi } from '../../api/facilityApi';
import { templateApi } from '../../api/templateApi';
import { inspectionApi } from '../../api/inspectionApi';
import { db, OfflineInspection } from '../../offline/db';
import { syncManager } from '../../offline/syncManager';
import { uploadQueue } from '../../offline/uploadQueue';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { Input, Textarea, Select } from '../../components/common/Input';

interface ChecklistResponseState {
  fieldId: string;
  key: string;
  label: string;
  result?: 'PASS' | 'FAIL' | 'NA';
  numericValue?: number;
  textValue?: string;
  selectedOption?: string;
  notes?: string;
  attachmentIds: string[];
  localPhotoUrls: string[];
  isFlaggedDefect?: boolean;
  failedReason?: string;
}

export const InspectionExecution: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id: draftIdFromRoute } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { isOnline, syncNow } = useSync();

  // Setup parameters
  const [inspectionId, setInspectionId] = useState<string>(
    draftIdFromRoute || crypto.randomUUID()
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    searchParams.get('facilityId') || ''
  );
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>(
    searchParams.get('checkpointId') || ''
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    searchParams.get('zoneId') || ''
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    searchParams.get('templateId') || ''
  );

  // Entities
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<InspectionTemplate | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  // Inspection form state
  const [responses, setResponses] = useState<Record<string, ChecklistResponseState>>({});
  const [summaryNotes, setSummaryNotes] = useState('');
  const [weatherCondition, setWeatherCondition] = useState('Clear / Normal Indoor');
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedMessage, setDraftSavedMessage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load facilities and templates
  useEffect(() => {
    const loadPrerequisites = async () => {
      setLoading(true);
      try {
        const [facRes, tplRes] = await Promise.all([
          facilityApi.getFacilities(),
          templateApi.getTemplates({ onlyLatest: 'true' }),
        ]);

        if (facRes.success && facRes.data) {
          setFacilities(facRes.data);
          if (!selectedFacilityId && facRes.data.length > 0) {
            setSelectedFacilityId(facRes.data[0].id);
          }
        }

        if (tplRes.success && tplRes.data) {
          setTemplates(tplRes.data);
          const activeTpl =
            tplRes.data.find((t) => t.id === selectedTemplateId) || tplRes.data[0];
          if (activeTpl) {
            setSelectedTemplate(activeTpl);
            setSelectedTemplateId(activeTpl.id);
          }
        }

        // Check if resuming an existing draft from IndexedDB
        if (draftIdFromRoute) {
          const existing = await db.offlineInspections.get(draftIdFromRoute);
          if (existing) {
            setInspectionId(existing.id);
            setSelectedFacilityId(existing.facilityId);
            setSelectedZoneId(existing.zoneId || '');
            setSelectedCheckpointId(existing.checkpointId || '');
            setSelectedTemplateId(existing.templateId);
            setSummaryNotes(existing.summaryNotes || '');
            setStartedAt(existing.startedAt);

            const initialMap: Record<string, ChecklistResponseState> = {};
            existing.items.forEach((item: any) => {
              initialMap[item.fieldId] = {
                ...item,
                localPhotoUrls: [],
              };
            });
            setResponses(initialMap);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadPrerequisites();
  }, [draftIdFromRoute]);

  // When facility changes, load checkpoints
  useEffect(() => {
    if (selectedFacilityId) {
      facilityApi.getCheckpoints({ facilityId: selectedFacilityId }).then((res) => {
        if (res.success && res.data) setCheckpoints(res.data);
      });
    }
  }, [selectedFacilityId]);

  // When template changes, initialize response items
  useEffect(() => {
    if (selectedTemplateId) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        setSelectedTemplate(tpl);
        // Initialize responses if empty
        if (Object.keys(responses).length === 0) {
          const initMap: Record<string, ChecklistResponseState> = {};
          (tpl.fields || []).forEach((field) => {
            initMap[field.id] = {
              fieldId: field.id,
              key: field.key,
              label: field.label,
              result: undefined,
              attachmentIds: [],
              localPhotoUrls: [],
            };
          });
          setResponses(initMap);
        }
      }
    }
  }, [selectedTemplateId, templates]);

  // Save draft to Dexie IndexedDB
  const handleSaveDraft = async () => {
    if (!selectedTemplate) return;

    const draftRecord: OfflineInspection = {
      id: inspectionId,
      templateId: selectedTemplate.id,
      templateVersion: selectedTemplate.version,
      facilityId: selectedFacilityId,
      zoneId: selectedZoneId || null,
      checkpointId: selectedCheckpointId || null,
      inspectorId: user?.id || 'offline_inspector',
      status: 'DRAFT',
      startedAt,
      summaryNotes,
      weatherCondition,
      items: Object.values(responses),
      version: 1,
      syncStatus: 'DRAFT',
      createdAt: startedAt,
      updatedAt: new Date().toISOString(),
    };

    await db.offlineInspections.put(draftRecord);
    setDraftSavedMessage(true);
    setTimeout(() => setDraftSavedMessage(false), 3000);
  };

  // Update a response item with automatic defect checking
  const handleItemResultChange = (
    fieldId: string,
    result: 'PASS' | 'FAIL' | 'NA',
    fieldDef?: any
  ) => {
    const current = responses[fieldId] || {
      fieldId,
      key: fieldDef?.key || '',
      label: fieldDef?.label || '',
      attachmentIds: [],
      localPhotoUrls: [],
    };

    const isFail = result === 'FAIL';
    const isCritical = fieldDef?.isCriticalFailure;

    setResponses({
      ...responses,
      [fieldId]: {
        ...current,
        result,
        isFlaggedDefect: isFail && isCritical,
        failedReason: isFail ? `Checkpoint failed inspection standard: ${fieldDef?.label}` : undefined,
      },
    });
  };

  // Handle Photo Attachment capture (works fully offline)
  const handlePhotoCapture = async (
    fieldId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    const item = responses[fieldId];

    // Enqueue in resumable upload queue (stores blob in Dexie offline database)
    const uploadItem = await uploadQueue.enqueuePhoto(
      file,
      file.name,
      'INSPECTION',
      inspectionId
    );

    setResponses({
      ...responses,
      [fieldId]: {
        ...item,
        attachmentIds: [...(item?.attachmentIds || []), uploadItem.id],
        localPhotoUrls: [...(item?.localPhotoUrls || []), previewUrl],
      },
    });
  };

  // Submit Inspection (Online direct submit or Offline outbox queue!)
  const handleSubmitInspection = async () => {
    setValidationError(null);

    if (!selectedFacilityId) {
      setValidationError('Please select a facility for this inspection.');
      return;
    }

    if (!selectedTemplate) {
      setValidationError('Inspection template definition is required.');
      return;
    }

    // Validate that required fields are answered
    for (const field of selectedTemplate.fields || []) {
      if (field.required) {
        const resp = responses[field.id];
        if (!resp || !resp.result) {
          setValidationError(`Required item "${field.label}" must be answered.`);
          return;
        }

        if (
          resp.result === 'FAIL' &&
          field.requireEvidenceOnFailure &&
          (!resp.attachmentIds || resp.attachmentIds.length === 0)
        ) {
          setValidationError(`Photo evidence is required for failed checkpoint "${field.label}".`);
          return;
        }
      }
    }

    setSubmitting(true);

    const payload = {
      id: inspectionId,
      templateId: selectedTemplate.id,
      templateVersion: selectedTemplate.version || 1,
      facilityId: selectedFacilityId,
      zoneId: selectedZoneId || undefined,
      checkpointId: selectedCheckpointId || undefined,
      status: 'SUBMITTED' as const,
      startedAt,
      completedAt: new Date().toISOString(),
      summaryNotes,
      weatherCondition,
      items: Object.values(responses).map((r) => ({
        fieldId: r.fieldId,
        key: r.key,
        label: r.label,
        result: r.result || 'PASS',
        numericValue: r.numericValue,
        textValue: r.textValue,
        notes: r.notes,
        attachmentIds: r.attachmentIds || [],
        isFlaggedDefect: r.isFlaggedDefect || false,
        failedReason: r.failedReason,
      })),
    };

    try {
      if (isOnline) {
        // Online: directly submit via API
        const res = await inspectionApi.submitInspection(payload);
        if (res.success) {
          // Remove draft from local DB or mark synced
          await db.offlineInspections.put({
            ...payload,
            inspectorId: user?.id || '',
            status: 'SUBMITTED',
            version: 1,
            syncStatus: 'SYNCED',
            createdAt: startedAt,
            updatedAt: new Date().toISOString(),
          } as any);

          navigate(`/inspections/${inspectionId}`);
          return;
        }
      }

      // Offline OR Server fallback: Save to local Dexie + queue in Outbox!
      await db.offlineInspections.put({
        ...payload,
        inspectorId: user?.id || '',
        status: 'SUBMITTED',
        version: 1,
        syncStatus: 'PENDING',
        createdAt: startedAt,
        updatedAt: new Date().toISOString(),
      } as any);

      await syncManager.queueOperation({
        entityType: 'INSPECTION',
        action: 'CREATE',
        recordId: inspectionId,
        baseVersion: 1,
        payload,
        clientTimestamp: new Date().toISOString(),
      });

      // Navigate to inspections list with offline confirmation
      navigate('/inspections');
    } catch (err: any) {
      setValidationError(err.message || 'Submission error. Record preserved locally in drafts.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
        <div>
          <Link
            to="/inspections"
            className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel Inspection</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            {selectedTemplate?.name || 'Conduct Facility Inspection'}
          </h1>
          <p className="text-xs text-muted">
            Inspection ID: <span className="font-mono">{inspectionId.substring(0, 8)}...</span> &bull; Offline Auto-save Active
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Save className="w-4 h-4" />}
            onClick={handleSaveDraft}
          >
            Save Draft
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<ClipboardCheck className="w-4 h-4" />}
            loading={submitting}
            onClick={handleSubmitInspection}
          >
            Submit Inspection
          </Button>
        </div>
      </div>

      {draftSavedMessage && (
        <div className="p-3 bg-sage-bg border border-[#D5DDD5] text-sage text-xs font-semibold rounded flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          <span>Inspection draft successfully preserved in local IndexedDB offline storage.</span>
        </div>
      )}

      {validationError && (
        <div className="p-3 bg-crimson-bg border border-[#F2D6D3] text-crimson text-xs font-medium rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Target Location & Template Selector */}
      <Card title="Inspection Scope & Checkpoint Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Facility"
            required
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
          >
            <option value="">Select Facility...</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </Select>

          <Select
            label="Inspection Template"
            required
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            <option value="">Select Checklist Template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (v{t.version})
              </option>
            ))}
          </Select>

          <Select
            label="Target Checkpoint (Optional)"
            value={selectedCheckpointId}
            onChange={(e) => setSelectedCheckpointId(e.target.value)}
          >
            <option value="">Whole Facility / General Inspection</option>
            {checkpoints.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name} ({cp.code})
              </option>
            ))}
          </Select>

          <Input
            label="Environmental / Weather Condition"
            value={weatherCondition}
            onChange={(e) => setWeatherCondition(e.target.value)}
          />
        </div>
      </Card>

      {/* Checklist items list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-charcoal">
            Inspection Checklist ({selectedTemplate?.fields?.length || 0} items)
          </h2>
          <span className="text-xs text-muted">
            Tap Pass / Fail / NA for each checkpoint
          </span>
        </div>

        {selectedTemplate?.fields?.map((field, idx) => {
          const resp = responses[field.id] || {
            fieldId: field.id,
            key: field.key,
            label: field.label,
            attachmentIds: [],
            localPhotoUrls: [],
          };

          const isFailed = resp.result === 'FAIL';

          return (
            <Card
              key={field.id}
              padding="md"
              className={`transition-all ${
                isFailed
                  ? 'border-crimson bg-crimson-bg/10 shadow-subtle'
                  : resp.result === 'PASS'
                  ? 'border-sage/40 bg-[#FAFBF9]'
                  : ''
              }`}
            >
              {/* Item Question header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sand-light text-charcoal flex items-center justify-center text-xs font-bold tabular-nums">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-charcoal leading-snug">
                      {field.label}
                      {field.required && <span className="text-crimson ml-1">*</span>}
                    </h3>
                  </div>

                  {field.instructions && (
                    <p className="text-xs text-muted pl-7">{field.instructions}</p>
                  )}
                </div>

                {field.isCriticalFailure && (
                  <Badge variant="crimson" size="sm" className="shrink-0">
                    Defect Rule
                  </Badge>
                )}
              </div>

              {/* Pass / Fail / NA Action Buttons */}
              <div className="mt-4 pt-3 border-t border-warm/60 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleItemResultChange(field.id, 'PASS', field)}
                  className={`flex-1 py-2.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all border select-none ${
                    resp.result === 'PASS'
                      ? 'bg-sage text-white border-sage shadow-sm'
                      : 'bg-white border-warm text-charcoal hover:bg-sand-light'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemResultChange(field.id, 'FAIL', field)}
                  className={`flex-1 py-2.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all border select-none ${
                    resp.result === 'FAIL'
                      ? 'bg-crimson text-white border-crimson shadow-sm'
                      : 'bg-white border-warm text-charcoal hover:bg-sand-light'
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>Fail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemResultChange(field.id, 'NA', field)}
                  className={`py-2.5 px-4 rounded-md font-semibold text-xs flex items-center justify-center gap-1 transition-all border select-none ${
                    resp.result === 'NA'
                      ? 'bg-charcoal text-white border-charcoal shadow-sm'
                      : 'bg-white border-warm text-muted hover:bg-sand-light'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>N/A</span>
                </button>
              </div>

              {/* Numeric Reading input if applicable */}
              {field.type === 'NUMERIC' && (
                <div className="mt-3 p-3 bg-white border border-warm rounded">
                  <Input
                    label={`Observed Reading (${field.unit || 'Units'})`}
                    type="number"
                    value={resp.numericValue ?? ''}
                    placeholder={`Expected: ${field.minNumeric ?? ''} - ${field.maxNumeric ?? ''} ${field.unit || ''}`}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                      const isOutOfRange =
                        val !== undefined &&
                        ((field.minNumeric !== undefined && val < field.minNumeric) ||
                          (field.maxNumeric !== undefined && val > field.maxNumeric));

                      setResponses({
                        ...responses,
                        [field.id]: {
                          ...resp,
                          numericValue: val,
                          result: isOutOfRange ? 'FAIL' : 'PASS',
                          isFlaggedDefect: isOutOfRange && field.isCriticalFailure,
                        },
                      });
                    }}
                  />
                </div>
              )}

              {/* Automatic Defect Alert Notice */}
              {resp.isFlaggedDefect && (
                <div className="mt-3 p-2.5 bg-crimson-bg border border-[#F2D6D3] rounded text-xs text-crimson flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Auto-Defect:</strong> A work order ({field.failureDefectSeverity || 'MEDIUM'} severity) will be automatically created upon submission.
                  </span>
                </div>
              )}

              {/* Notes and Photo Evidence capture */}
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="Technician observation notes (optional)..."
                  value={resp.notes || ''}
                  onChange={(e) =>
                    setResponses({
                      ...responses,
                      [field.id]: { ...resp, notes: e.target.value },
                    })
                  }
                  className="w-full text-xs px-3 py-1.5 rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
                />

                {/* Photo Evidence attachments */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-warm rounded bg-white hover:bg-sand-light text-charcoal font-medium transition-colors">
                    <Camera className="w-3.5 h-3.5 text-terracotta" />
                    <span>Attach Photo Evidence</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoCapture(field.id, e)}
                    />
                  </label>

                  {/* Thumbnail previews */}
                  {(resp.localPhotoUrls || []).map((url, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded border border-warm overflow-hidden relative shadow-subtle"
                    >
                      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                  ))}

                  {resp.attachmentIds?.length > 0 && (
                    <span className="text-[11px] text-muted">
                      {resp.attachmentIds.length} photo{resp.attachmentIds.length === 1 ? '' : 's'} queued
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary Notes Card */}
      <Card title="Inspector Sign-off & Concluding Notes">
        <Textarea
          placeholder="Overall inspection summary, weather conditions, escort personnel, or follow-up recommendations..."
          value={summaryNotes}
          onChange={(e) => setSummaryNotes(e.target.value)}
        />
      </Card>

      {/* Bottom Submit Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-warm">
        <Button variant="ghost" onClick={handleSaveDraft}>
          Save Draft (IndexedDB)
        </Button>

        <Button
          variant="primary"
          size="lg"
          icon={<ClipboardCheck className="w-5 h-5" />}
          loading={submitting}
          onClick={handleSubmitInspection}
        >
          Submit Inspection
        </Button>
      </div>
    </div>
  );
};
