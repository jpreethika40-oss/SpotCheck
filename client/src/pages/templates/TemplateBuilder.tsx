import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Layers,
} from 'lucide-react';
import { TemplateFieldDef, FieldType, IssueSeverity } from '@spotcheck/shared';
import { templateApi } from '../../api/templateApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export const TemplateBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isEditing = Boolean(id && id !== 'new');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [facilityType, setFacilityType] = useState('COMMERCIAL');
  const [fields, setFields] = useState<TemplateFieldDef[]>([
    {
      id: crypto.randomUUID(),
      key: 'general_safety',
      label: 'General Workspace Safety & Hazard Clearance',
      type: 'PASS_FAIL',
      required: true,
      instructions: 'Verify no obstructions in emergency egress routes or fire exits.',
      isCriticalFailure: true,
      failureDefectSeverity: 'HIGH',
      failureDefectCategory: 'Safety',
      requireEvidenceOnFailure: true,
    },
    {
      id: crypto.randomUUID(),
      key: 'temp_reading',
      label: 'Chilled Water Supply Temperature',
      type: 'NUMERIC',
      required: true,
      minNumeric: 38,
      maxNumeric: 48,
      unit: '°F',
      isCriticalFailure: true,
      failureDefectSeverity: 'MEDIUM',
      failureDefectCategory: 'HVAC',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && id) {
      templateApi.getTemplateById(id).then((res) => {
        if (res.success && res.data) {
          setName(res.data.name);
          setDescription(res.data.description || '');
          if (res.data.facilityType) setFacilityType(res.data.facilityType);
          if (res.data.fields && res.data.fields.length > 0) {
            setFields(res.data.fields);
          }
        }
      });
    }
  }, [id, isEditing]);

  const addField = () => {
    const newField: TemplateFieldDef = {
      id: crypto.randomUUID(),
      key: `field_${Date.now().toString(36)}`,
      label: 'New Checkpoint Item',
      type: 'PASS_FAIL',
      required: true,
      isCriticalFailure: false,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<TemplateFieldDef>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  const removeField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setFields(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name,
        description,
        facilityType: facilityType as any,
        fields,
        isActive: true,
      };

      let res;
      if (isEditing && id) {
        res = await templateApi.updateTemplate(id, payload);
      } else {
        res = await templateApi.createTemplate(payload);
      }

      if (res.success) {
        navigate('/templates');
      } else {
        setError(res.error?.message || 'Failed to save template.');
      }
    } catch (err: any) {
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <Link
        to="/templates"
        className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Templates</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            {isEditing ? 'Edit Inspection Template' : 'Create Inspection Template'}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configure checklist items, numeric tolerance ranges, and automatic defect trigger rules.
          </p>
        </div>

        <Button type="submit" variant="primary" loading={submitting} icon={<Save className="w-4 h-4" />}>
          {isEditing ? 'Save / Bump Version' : 'Save Template'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-crimson-bg border border-[#F2D6D3] text-xs text-crimson font-medium">
          {error}
        </div>
      )}

      {/* Meta properties */}
      <Card title="General Template Details">
        <div className="space-y-4">
          <Input
            label="Template Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly Central Plant & HVAC Audit"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Facility Type Classification"
              value={facilityType}
              onChange={(e) => setFacilityType(e.target.value)}
              options={[
                { value: 'COMMERCIAL', label: 'Commercial' },
                { value: 'INDUSTRIAL', label: 'Industrial' },
                { value: 'HEALTHCARE', label: 'Healthcare' },
                { value: 'EDUCATIONAL', label: 'Educational' },
                { value: 'RESIDENTIAL', label: 'Residential' },
                { value: 'WAREHOUSE', label: 'Warehouse' },
              ]}
            />
          </div>

          <Textarea
            label="Purpose & Scope Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Standardized technical audit covering mechanical rooms, fire suppressors, and electrical distribution."
          />
        </div>
      </Card>

      {/* Checkpoints and Questions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-charcoal">Checklist Items & Defect Triggers</h3>
            <p className="text-xs text-muted">
              Define the verification steps that technicians and inspectors perform in the field.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Plus className="w-4 h-4" />}
            onClick={addField}
          >
            Add Checkpoint Item
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((f, index) => (
            <Card key={f.id || index} padding="md" className="border-l-4 border-l-terracotta">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-warm mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sand-light text-charcoal flex items-center justify-center text-xs font-bold tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-muted uppercase">
                    Field ID: {f.key}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveField(index, 'up')}
                    className="p-1 rounded text-muted hover:text-charcoal disabled:opacity-30"
                    title="Move up"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 'down')}
                    className="p-1 rounded text-muted hover:text-charcoal disabled:opacity-30"
                    title="Move down"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="p-1 rounded text-crimson hover:bg-crimson-bg ml-1"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Input
                    label="Question / Inspection Checkpoint Title"
                    required
                    value={f.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                </div>

                <Select
                  label="Field Type"
                  value={f.type}
                  onChange={(e) => updateField(index, { type: e.target.value as FieldType })}
                  options={[
                    { value: 'PASS_FAIL', label: 'Pass / Fail / N/A' },
                    { value: 'NUMERIC', label: 'Numeric Reading' },
                    { value: 'TEXT', label: 'Text Observation' },
                    { value: 'SINGLE_CHOICE', label: 'Single Choice Dropdown' },
                    { value: 'CHECKBOX', label: 'Multi-Select Checkboxes' },
                    { value: 'PHOTO_EVIDENCE', label: 'Photo Evidence Only' },
                  ]}
                />
              </div>

              {/* Conditional configurations based on type */}
              {f.type === 'NUMERIC' && (
                <div className="grid grid-cols-3 gap-3 mt-3 p-3 bg-sand-light/40 rounded border border-warm">
                  <Input
                    label="Min Value"
                    type="number"
                    value={f.minNumeric ?? ''}
                    onChange={(e) =>
                      updateField(index, {
                        minNumeric: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    label="Max Value"
                    type="number"
                    value={f.maxNumeric ?? ''}
                    onChange={(e) =>
                      updateField(index, {
                        maxNumeric: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    label="Measurement Unit"
                    placeholder="e.g. PSI, °F, Amps"
                    value={f.unit || ''}
                    onChange={(e) => updateField(index, { unit: e.target.value })}
                  />
                </div>
              )}

              {f.type === 'SINGLE_CHOICE' && (
                <div className="mt-3 p-3 bg-sand-light/40 rounded border border-warm">
                  <Input
                    label="Dropdown Options (Comma separated)"
                    placeholder="Clean, Minor Dust, Heavy Debris, Clogged"
                    value={(f.options || []).join(', ')}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              )}

              <div className="mt-3">
                <Input
                  label="Field Guidance & Instructions"
                  placeholder="Instructions displayed to the inspector in the mobile checklist"
                  value={f.instructions || ''}
                  onChange={(e) => updateField(index, { instructions: e.target.value })}
                />
              </div>

              {/* Automatic Defect Trigger Toggle */}
              <div className="mt-4 pt-3 border-t border-warm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFAF6] p-3 rounded">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-charcoal">
                  <input
                    type="checkbox"
                    checked={f.isCriticalFailure}
                    onChange={(e) => updateField(index, { isCriticalFailure: e.target.checked })}
                    className="w-4 h-4 text-terracotta rounded border-warm focus:ring-terracotta"
                  />
                  <span>Auto-create Work Order Issue on Failure</span>
                </label>

                {f.isCriticalFailure && (
                  <div className="flex items-center gap-3">
                    <Select
                      label="Defect Severity"
                      value={f.failureDefectSeverity || 'MEDIUM'}
                      onChange={(e) =>
                        updateField(index, {
                          failureDefectSeverity: e.target.value as IssueSeverity,
                        })
                      }
                      options={[
                        { value: 'LOW', label: 'Low Severity' },
                        { value: 'MEDIUM', label: 'Medium Severity' },
                        { value: 'HIGH', label: 'High Severity' },
                        { value: 'CRITICAL', label: 'Critical Severity' },
                      ]}
                    />

                    <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer mt-5">
                      <input
                        type="checkbox"
                        checked={f.requireEvidenceOnFailure ?? true}
                        onChange={(e) =>
                          updateField(index, { requireEvidenceOnFailure: e.target.checked })
                        }
                        className="w-3.5 h-3.5 text-terracotta rounded border-warm focus:ring-terracotta"
                      />
                      <span>Require Photo</span>
                    </label>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-warm">
        <Link to="/templates">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="primary" loading={submitting} icon={<Save className="w-4 h-4" />}>
          {isEditing ? 'Save & Bump Version' : 'Save Template'}
        </Button>
      </div>
    </form>
  );
};
