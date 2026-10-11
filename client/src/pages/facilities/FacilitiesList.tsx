import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, MapPin, Layers, Box, ArrowRight } from 'lucide-react';
import { Facility } from '@spotcheck/shared';
import { facilityApi } from '../../api/facilityApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';

export const FacilitiesList: React.FC = () => {
  const { isManager } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'COMMERCIAL',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const res = await facilityApi.getFacilities({
        search: search || undefined,
        type: typeFilter || undefined,
      });
      if (res.success && res.data) {
        setFacilities(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFacilities();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await facilityApi.createFacility(formData as any);
      if (res.success) {
        setCreateOpen(false);
        setFormData({
          name: '',
          code: '',
          type: 'COMMERCIAL',
          address: '',
          city: '',
          state: '',
          postalCode: '',
        });
        fetchFacilities();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Managed Facilities
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Buildings, physical zones, checkpoint hierarchies, and tracked equipment
          </p>
        </div>

        {isManager && (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Add Facility
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by facility name, code, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-warm bg-white focus:outline-none focus:border-terracotta"
            >
              <option value="">All Facility Types</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INDUSTRIAL">Industrial</option>
              <option value="HEALTHCARE">Healthcare</option>
              <option value="EDUCATIONAL">Educational</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="WAREHOUSE">Warehouse</option>
            </select>
          </div>

          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
        </form>
      </Card>

      {/* Facility Grid */}
      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : facilities.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8 text-muted" />}
          title="No facilities found"
          description="No facilities match your search query or filter parameters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {facilities.map((facility) => (
            <Card key={facility.id} padding="none" className="flex flex-col justify-between hover:border-terracotta/40 transition-colors">
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-muted uppercase">
                      {facility.code}
                    </span>
                    <h3 className="text-base font-bold text-charcoal mt-0.5">
                      {facility.name}
                    </h3>
                  </div>
                  <Badge variant="sand" size="sm">
                    {facility.type}
                  </Badge>
                </div>

                <div className="mt-3 text-xs text-muted flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-terracotta shrink-0 mt-0.5" />
                  <span className="line-clamp-2">
                    {facility.address}, {facility.city}, {facility.state} {facility.postalCode}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-warm/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-sand-light/50 p-2 rounded">
                    <span className="block text-[10px] text-muted uppercase font-medium">Zones</span>
                    <span className="font-bold text-charcoal tabular-nums">
                      {facility._count?.zones ?? 0}
                    </span>
                  </div>
                  <div className="bg-sand-light/50 p-2 rounded">
                    <span className="block text-[10px] text-muted uppercase font-medium">Assets</span>
                    <span className="font-bold text-charcoal tabular-nums">
                      {facility._count?.assets ?? 0}
                    </span>
                  </div>
                  <div className="bg-sand-light/50 p-2 rounded">
                    <span className="block text-[10px] text-muted uppercase font-medium">Defects</span>
                    <span className="font-bold text-crimson tabular-nums">
                      {facility._count?.issues ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FCFAF6] border-t border-warm px-5 py-3 flex items-center justify-between">
                <StatusBadge status={facility.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                <Link
                  to={`/facilities/${facility.id}`}
                  className="text-xs font-semibold text-terracotta hover:text-terracotta-hover inline-flex items-center gap-1"
                >
                  <span>Explore Hierarchy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Facility Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Facility"
        description="Provision a new building or industrial site into the system."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3">
          <Input
            label="Facility Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Apex Manufacturing Plant"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Unique Code"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="FAC-APEX-01"
            />

            <Select
              label="Facility Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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

          <Input
            label="Address"
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="1000 Industrial Parkway"
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Austin"
            />
            <Input
              label="State"
              required
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="TX"
            />
            <Input
              label="Postal Code"
              required
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="78701"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-warm mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Create Facility
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
