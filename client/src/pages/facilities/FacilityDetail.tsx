import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  Layers,
  MapPin,
  Plus,
  QrCode,
  Box,
  ClipboardCheck,
  Download,
  AlertTriangle,
  ArrowLeft,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { Facility, Zone, Checkpoint, Asset } from '@spotcheck/shared';
import { facilityApi } from '../../api/facilityApi';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select, Textarea } from '../../components/common/Input';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';

export const FacilityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isManager } = useAuth();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'zones' | 'checkpoints' | 'assets'>('zones');

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);

  const [createZoneOpen, setCreateZoneOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', code: '', floor: '', description: '' });

  const [createCheckpointOpen, setCreateCheckpointOpen] = useState(false);
  const [checkpointForm, setCheckpointForm] = useState({
    zoneId: '',
    name: '',
    code: '',
    locationDescription: '',
    instructions: '',
  });

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [facRes, zonesRes, checkRes, assetsRes] = await Promise.all([
        facilityApi.getFacilityById(id),
        facilityApi.getZones(id),
        facilityApi.getCheckpoints({ facilityId: id }),
        facilityApi.getAssets({ facilityId: id }),
      ]);

      if (facRes.success && facRes.data) setFacility(facRes.data);
      if (zonesRes.success && zonesRes.data) setZones(zonesRes.data);
      if (checkRes.success && checkRes.data) setCheckpoints(checkRes.data);
      if (assetsRes.success && assetsRes.data) setAssets(assetsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const res = await facilityApi.createZone(id, zoneForm);
    if (res.success) {
      setCreateZoneOpen(false);
      setZoneForm({ name: '', code: '', floor: '', description: '' });
      fetchData();
    }
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const res = await facilityApi.createCheckpoint({
      facilityId: id,
      ...checkpointForm,
    });
    if (res.success) {
      setCreateCheckpointOpen(false);
      setCheckpointForm({ zoneId: '', name: '', code: '', locationDescription: '', instructions: '' });
      fetchData();
    }
  };

  if (loading) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  if (!facility) {
    return (
      <EmptyState
        title="Facility Not Found"
        description="The requested facility identifier does not exist."
        action={
          <Link to="/facilities">
            <Button size="sm" variant="secondary">
              Back to Facilities
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div>
        <Link
          to="/facilities"
          className="text-xs font-semibold text-muted hover:text-charcoal inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Facilities</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-sand px-2 py-0.5 rounded text-charcoal">
                {facility.code}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-charcoal">
                {facility.name}
              </h1>
              <StatusBadge status={facility.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
            </div>
            <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-terracotta" />
              <span>
                {facility.address}, {facility.city}, {facility.state} {facility.postalCode}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/inspections/new?facilityId=${facility.id}`}>
              <Button size="sm" variant="primary" icon={<ClipboardCheck className="w-4 h-4" />}>
                Inspect Facility
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-warm flex gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('zones')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'zones'
              ? 'border-terracotta text-terracotta'
              : 'border-transparent text-muted hover:text-charcoal'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Zones ({zones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('checkpoints')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'checkpoints'
              ? 'border-terracotta text-terracotta'
              : 'border-transparent text-muted hover:text-charcoal'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Checkpoints ({checkpoints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'assets'
              ? 'border-terracotta text-terracotta'
              : 'border-transparent text-muted hover:text-charcoal'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>Tracked Assets ({assets.length})</span>
        </button>
      </div>

      {/* Tab: Zones */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Physical floors, wings, and zones configured within this facility.
            </p>
            {isManager && (
              <Button
                size="sm"
                variant="outline"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setCreateZoneOpen(true)}
              >
                Add Zone
              </Button>
            )}
          </div>

          {zones.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-8 h-8 text-muted" />}
              title="No Zones Configured"
              description="Add zones to divide this facility into inspectable areas."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <Card key={zone.id} padding="md" className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-muted uppercase font-bold">
                        {zone.code}
                      </span>
                      <h4 className="text-sm font-bold text-charcoal">{zone.name}</h4>
                    </div>
                    {zone.floor && (
                      <Badge variant="sand" size="sm">
                        Floor {zone.floor}
                      </Badge>
                    )}
                  </div>
                  {zone.description && (
                    <p className="text-xs text-muted line-clamp-2">{zone.description}</p>
                  )}
                  <div className="pt-2 flex items-center justify-between text-xs text-muted border-t border-warm/60">
                    <span>{checkpoints.filter((c) => c.zoneId === zone.id).length} checkpoints</span>
                    <span>{assets.filter((a) => a.zoneId === zone.id).length} assets</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Checkpoints */}
      {activeTab === 'checkpoints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Inspection checkpoints with unique cryptographic QR tokens for physical presence verification.
            </p>
            {isManager && (
              <Button
                size="sm"
                variant="outline"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setCreateCheckpointOpen(true)}
              >
                Add Checkpoint
              </Button>
            )}
          </div>

          {checkpoints.length === 0 ? (
            <EmptyState
              icon={<QrCode className="w-8 h-8 text-muted" />}
              title="No Checkpoints"
              description="Create checkpoints to generate printable QR codes for field verification."
            />
          ) : (
            <div className="bg-surface border border-warm rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Code / Name</th>
                    <th className="p-3">Zone</th>
                    <th className="p-3">QR Token</th>
                    <th className="p-3">Instructions</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm">
                  {checkpoints.map((cp) => (
                    <tr key={cp.id} className="hover:bg-ivory/50">
                      <td className="p-3">
                        <span className="font-mono text-[11px] text-muted block">{cp.code}</span>
                        <span className="font-semibold text-charcoal">{cp.name}</span>
                      </td>
                      <td className="p-3 text-charcoal font-medium">
                        {zones.find((z) => z.id === cp.zoneId)?.name || 'General'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted">
                        <span className="bg-sand-light px-2 py-0.5 rounded border border-warm">
                          {cp.qrCodeToken}
                        </span>
                      </td>
                      <td className="p-3 text-muted max-w-xs truncate">
                        {cp.instructions || cp.locationDescription || '—'}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<QrCode className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedCheckpoint(cp);
                            setQrModalOpen(true);
                          }}
                        >
                          View QR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Assets */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Machinery, HVAC, electrical, and structural assets registered to this facility.
            </p>
            <Link to="/assets">
              <Button size="sm" variant="outline" icon={<Box className="w-4 h-4" />}>
                Open Asset Registry
              </Button>
            </Link>
          </div>

          {assets.length === 0 ? (
            <EmptyState
              icon={<Box className="w-8 h-8 text-muted" />}
              title="No Tracked Assets"
              description="Register machinery and facility equipment to track maintenance logs."
            />
          ) : (
            <div className="bg-surface border border-warm rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FCFAF6] border-b border-warm text-muted font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Asset Tag</th>
                    <th className="p-3">Equipment Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Criticality</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-ivory/50">
                      <td className="p-3 font-mono font-bold text-charcoal">{asset.assetTag}</td>
                      <td className="p-3 font-semibold text-charcoal">{asset.name}</td>
                      <td className="p-3 text-muted">{asset.category}</td>
                      <td className="p-3">
                        <StatusBadge status={asset.criticality} size="sm" />
                      </td>
                      <td className="p-3">
                        <StatusBadge status={asset.status} size="sm" />
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          to={`/assets/${asset.id}`}
                          className="text-xs font-semibold text-terracotta hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QR Code Sticker Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Inspection Checkpoint QR Badge"
        description="Scan this physical token on-site to verify physical checkpoint arrival."
      >
        {selectedCheckpoint && (
          <div className="text-center space-y-4 py-2">
            <div className="inline-block p-6 bg-white border-2 border-charcoal rounded-lg shadow-subtle">
              {/* Simulated crisp high-contrast SVG QR code */}
              <div className="w-48 h-48 mx-auto flex items-center justify-center border-4 border-charcoal p-2 bg-white">
                <svg className="w-full h-full" viewBox="0 0 29 29" fill="black">
                  <path d="M0 0h7v7H0zM2 2v3h3V2zm7 0h2v1H9zm3 0h1v1h-1zm2 0h1v1h-1zm3 0h1v2h-1zm3 0h1v1h-1zm2 0h7v7h-7zm2 2v3h3V2zM0 9h1v1H0zm2 0h3v1H2zm4 0h1v1H6zm3 0h1v1H9zm2 0h2v1h-2zm3 0h1v2h-1zm2 0h1v1h-1zm2 0h1v1h-1zm3 0h2v1h-2zm3 0h1v1h-1zm2 0h1v1h-1zM0 12h1v1H0zm2 0h1v1H2zm2 0h2v1H4zm3 0h2v1H7zm3 0h1v2h-1zm3 0h1v1h-1zm2 0h2v1h-2zm3 0h1v1h-1zm2 0h1v1h-1zm2 0h2v1h-2zm0 15h7v7h-7zm2 2v3h3v-3z" />
                </svg>
              </div>
              <p className="font-mono text-xs font-bold text-charcoal mt-3">
                {selectedCheckpoint.qrCodeToken}
              </p>
              <p className="text-[11px] text-muted">{selectedCheckpoint.name}</p>
            </div>

            <div className="text-xs text-muted space-y-1">
              <p>
                <strong>Facility:</strong> {facility.name} ({facility.code})
              </p>
              <p>
                <strong>Instructions:</strong>{' '}
                {selectedCheckpoint.instructions || 'Inspect equipment and environment.'}
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
              >
                Print Token
              </Button>
              <Link to={`/checkpoints/scan?token=${selectedCheckpoint.qrCodeToken}`}>
                <Button size="sm" variant="primary">
                  Test Scan Token
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Zone Modal */}
      <Modal
        isOpen={createZoneOpen}
        onClose={() => setCreateZoneOpen(false)}
        title="Add Facility Zone"
        description="Define a physical section, department, or floor of this facility."
      >
        <form onSubmit={handleCreateZone} className="space-y-3">
          <Input
            label="Zone Name"
            required
            value={zoneForm.name}
            onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
            placeholder="Mechanical Boiler Room"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Zone Code"
              required
              value={zoneForm.code}
              onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value.toUpperCase() })}
              placeholder="ZONE-MBR-01"
            />
            <Input
              label="Floor / Level"
              value={zoneForm.floor}
              onChange={(e) => setZoneForm({ ...zoneForm, floor: e.target.value })}
              placeholder="Basement / Level -1"
            />
          </div>
          <Textarea
            label="Description"
            value={zoneForm.description}
            onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
            placeholder="Main electrical switchboard and boiler unit area"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateZoneOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Zone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Checkpoint Modal */}
      <Modal
        isOpen={createCheckpointOpen}
        onClose={() => setCreateCheckpointOpen(false)}
        title="Add Checkpoint"
        description="Create an inspection point. A unique QR token will be generated."
      >
        <form onSubmit={handleCreateCheckpoint} className="space-y-3">
          <Select
            label="Belongs to Zone"
            required
            value={checkpointForm.zoneId}
            onChange={(e) => setCheckpointForm({ ...checkpointForm, zoneId: e.target.value })}
          >
            <option value="">Select a Zone...</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.code})
              </option>
            ))}
          </Select>

          <Input
            label="Checkpoint Name"
            required
            value={checkpointForm.name}
            onChange={(e) => setCheckpointForm({ ...checkpointForm, name: e.target.value })}
            placeholder="Emergency Generator & Fuel Valve"
          />

          <Input
            label="Checkpoint Code"
            required
            value={checkpointForm.code}
            onChange={(e) => setCheckpointForm({ ...checkpointForm, code: e.target.value.toUpperCase() })}
            placeholder="CP-GEN-01"
          />

          <Textarea
            label="Instructions for Inspector"
            value={checkpointForm.instructions}
            onChange={(e) => setCheckpointForm({ ...checkpointForm, instructions: e.target.value })}
            placeholder="Check fuel gauge, verify battery terminal tightness, ensure exhaust damper is unblocked."
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-warm">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateCheckpointOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create Checkpoint
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
