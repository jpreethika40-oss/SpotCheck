import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, ArrowLeft, Building, Layers, Shield, Calendar, Wrench, AlertTriangle } from 'lucide-react';
import { Asset } from '@spotcheck/shared';
import { facilityApi } from '../../api/facilityApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    facilityApi.getAssetById(id).then((res) => {
      if (res.success && res.data) setAsset(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <TableSkeleton rows={4} cols={3} />;

  if (!asset) {
    return (
      <EmptyState
        title="Asset Not Found"
        description="The requested equipment identifier does not exist."
        action={
          <Link to="/assets">
            <Button size="sm" variant="secondary">
              Back to Assets
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/assets"
        className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Asset Registry</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-sand px-2 py-0.5 rounded text-charcoal">
              {asset.assetTag}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-charcoal">{asset.name}</h1>
            <StatusBadge status={asset.status} size="sm" />
          </div>
          <p className="text-xs text-muted mt-1">
            Category: <strong className="text-charcoal">{asset.category}</strong> &bull; Criticality:{' '}
            <strong className="text-charcoal">{asset.criticality}</strong>
          </p>
        </div>

        <div className="flex gap-2">
          <Link to={`/work-orders?assetId=${asset.id}`}>
            <Button size="sm" variant="outline" icon={<AlertTriangle className="w-4 h-4" />}>
              Related Work Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Equipment Specifications">
          <dl className="divide-y divide-warm text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Manufacturer</dt>
              <dd className="font-semibold text-charcoal">{asset.manufacturer || '—'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Model Number</dt>
              <dd className="font-mono font-semibold text-charcoal">{asset.modelNumber || '—'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Serial Number</dt>
              <dd className="font-mono font-semibold text-charcoal">{asset.serialNumber || '—'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Category</dt>
              <dd className="font-semibold text-charcoal">{asset.category}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Operational Status & Maintenance">
          <dl className="divide-y divide-warm text-xs">
            <div className="py-2.5 flex justify-between items-center">
              <dt className="text-muted">Current Status</dt>
              <dd>
                <StatusBadge status={asset.status} size="sm" />
              </dd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <dt className="text-muted">Criticality Level</dt>
              <dd>
                <StatusBadge status={asset.criticality} size="sm" />
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Installation Date</dt>
              <dd className="text-charcoal">
                {asset.installationDate
                  ? new Date(asset.installationDate).toLocaleDateString()
                  : 'Not documented'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-muted">Registered At</dt>
              <dd className="text-charcoal">{new Date(asset.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
};
