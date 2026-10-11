import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Search, Plus, Filter, ArrowRight } from 'lucide-react';
import { Asset } from '@spotcheck/shared';
import { facilityApi } from '../../api/facilityApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const AssetsList: React.FC = () => {
  const { isManager } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [form, setForm] = useState({
    facilityId: '',
    name: '',
    assetTag: '',
    category: 'HVAC',
    criticality: 'MEDIUM',
    status: 'OPERATIONAL',
    manufacturer: '',
    modelNumber: '',
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await facilityApi.getAssets({
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      });
      if (res.success && res.data) {
        setAssets(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    facilityApi.getFacilities().then((r) => {
      if (r.success && r.data) setFacilities(r.data);
    });
  }, [categoryFilter, statusFilter]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await facilityApi.createAsset(form as any);
    if (res.success) {
      setCreateOpen(false);
      setForm({
        facilityId: '',
        name: '',
        assetTag: '',
        category: 'HVAC',
        criticality: 'MEDIUM',
        status: 'OPERATIONAL',
        manufacturer: '',
        modelNumber: '',
      });
      fetchAssets();
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.assetTag.toLowerCase().includes(q) ||
      (a.manufacturer && a.manufacturer.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Tracked Assets & Equipment
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Physical machinery, HVAC chillers, transformers, valves, and life-safety units
          </p>
        </div>

        {isManager && (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Register Asset
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by asset tag, name, or manufacturer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            />
          </div>

          <div className="w-full sm:w-44">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Categories</option>
              <option value="HVAC">HVAC</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="FIRE_SAFETY">Fire Safety</option>
              <option value="STRUCTURAL">Structural</option>
              <option value="ELEVATOR">Elevator</option>
              <option value="SECURITY">Security</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="NEEDS_ATTENTION">Needs Attention</option>
              <option value="OUT_OF_SERVICE">Out of Service</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Assets Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={<Box className="w-8 h-8 text-muted" />}
          title="No assets found"
          description="No registered machinery matched the specified search criteria."
        />
      ) : (
        <div className="bg-surface border border-warm rounded-md overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">Asset Tag</th>
                <th className="p-3">Asset Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Criticality</th>
                <th className="p-3">Manufacturer / Model</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-ivory/50">
                  <td className="p-3 font-mono font-bold text-charcoal">{asset.assetTag}</td>
                  <td className="p-3 font-semibold text-charcoal">{asset.name}</td>
                  <td className="p-3">
                    <Badge variant="sand" size="sm">
                      {asset.category}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={asset.criticality} size="sm" />
                  </td>
                  <td className="p-3 text-muted">
                    {asset.manufacturer || '—'} {asset.modelNumber ? `(${asset.modelNumber})` : ''}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={asset.status} size="sm" />
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/assets/${asset.id}`}
                      className="text-xs font-semibold text-terracotta hover:underline inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Asset Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register Equipment / Asset"
        description="Add a tracked physical machine or system component."
      >
        <form onSubmit={handleCreateAsset} className="space-y-3">
          <Select
            label="Facility"
            required
            value={form.facilityId}
            onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
          >
            <option value="">Select Facility...</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </Select>

          <Input
            label="Asset Tag / Identifier"
            required
            value={form.assetTag}
            onChange={(e) => setForm({ ...form, assetTag: e.target.value.toUpperCase() })}
            placeholder="AST-HVAC-CHL01"
          />

          <Input
            label="Equipment Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Centrifugal Water Chiller 500-Ton"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[
                { value: 'HVAC', label: 'HVAC' },
                { value: 'ELECTRICAL', label: 'Electrical' },
                { value: 'PLUMBING', label: 'Plumbing' },
                { value: 'FIRE_SAFETY', label: 'Fire Safety' },
                { value: 'STRUCTURAL', label: 'Structural' },
                { value: 'ELEVATOR', label: 'Elevator' },
                { value: 'SECURITY', label: 'Security' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />

            <Select
              label="Criticality"
              value={form.criticality}
              onChange={(e) => setForm({ ...form, criticality: e.target.value })}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Manufacturer"
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="Carrier / Trane"
            />
            <Input
              label="Model Number"
              value={form.modelNumber}
              onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
              placeholder="19XR-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Asset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
