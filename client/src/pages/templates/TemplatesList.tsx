import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';
import { InspectionTemplate } from '@spotcheck/shared';
import { templateApi } from '../../api/templateApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';

export const TemplatesList: React.FC = () => {
  const { isManager } = useAuth();
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templateApi.getTemplates({ onlyLatest: 'true' });
      if (res.success && res.data) {
        setTemplates(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Inspection Templates
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configurable checklist schemas, pass/fail criteria, numeric ranges, and automatic defect triggers
          </p>
        </div>

        {isManager && (
          <Link to="/templates/new">
            <Button size="sm" variant="primary" icon={<Plus className="w-4 h-4" />}>
              Create New Template
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="w-8 h-8 text-muted" />}
          title="No inspection templates"
          description="Create custom checklists to standardize facility audits."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              padding="none"
              className="flex flex-col justify-between hover:border-terracotta/40 transition-colors"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-charcoal leading-snug">{tpl.name}</h3>
                  <Badge variant="sand" size="sm">
                    v{tpl.version}
                  </Badge>
                </div>

                {tpl.description && (
                  <p className="text-xs text-muted line-clamp-2">{tpl.description}</p>
                )}

                <div className="pt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="sand" size="sm">
                    {tpl.facilityType || 'All Facilities'}
                  </Badge>
                  <Badge variant="sage" size="sm">
                    {tpl.fields?.length || 0} Checkpoints
                  </Badge>
                  {tpl.fields?.some((f) => f.isCriticalFailure) && (
                    <Badge variant="crimson" size="sm">
                      Auto-Defect Rules
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-[#FCFAF6] border-t border-warm px-5 py-3 flex items-center justify-between text-xs">
                <span className="text-muted">
                  Updated {new Date(tpl.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/templates/${tpl.id}`}
                    className="font-semibold text-terracotta hover:underline inline-flex items-center gap-1"
                  >
                    <span>Edit Schema</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
