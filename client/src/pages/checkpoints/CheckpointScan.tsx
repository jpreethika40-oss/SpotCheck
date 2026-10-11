import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QrCode, Search, CheckCircle2, AlertCircle, ArrowRight, Building, Layers } from 'lucide-react';
import { facilityApi } from '../../api/facilityApi';
import { Checkpoint } from '@spotcheck/shared';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export const CheckpointScan: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tokenInput, setTokenInput] = useState(searchParams.get('token') || '');
  const [loading, setLoading] = useState(false);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performLookup = async (token: string) => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    setCheckpoint(null);

    try {
      const res = await facilityApi.getCheckpointByToken(token.trim());
      if (res.success && res.data) {
        setCheckpoint(res.data);
      } else {
        setError(res.error?.message || 'Checkpoint token not recognized on server.');
      }
    } catch (err: any) {
      setError(err.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setTokenInput(urlToken);
      performLookup(urlToken);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(tokenInput);
  };

  const handleQuickToken = (t: string) => {
    setTokenInput(t);
    performLookup(t);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-sand-light text-terracotta mx-auto flex items-center justify-center mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-charcoal">
          Checkpoint QR Verification
        </h1>
        <p className="text-xs text-muted max-w-md mx-auto mt-1">
          Scan or input physical checkpoint QR token to authenticate physical on-site presence and load inspection definitions.
        </p>
      </div>

      {/* Token Input Form */}
      <Card padding="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="QR Checkpoint Token / Code"
            placeholder="e.g. QR-SPOTCHECK-APEX-CHL01"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            required
            helperText="Located on the physical QR badge affixed to the checkpoint."
          />

          <Button type="submit" fullWidth loading={loading} icon={<Search className="w-4 h-4" />}>
            Authenticate & Verify Checkpoint
          </Button>
        </form>

        {/* Quick Sample Tokens */}
        <div className="mt-4 pt-4 border-t border-warm">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
            Sample Seeded Checkpoint Tokens (Click to Test):
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickToken('QR-SPOTCHECK-APEX-CHL01')}
              className="px-2.5 py-1 text-xs font-mono bg-sand-light hover:bg-sand border border-warm rounded text-charcoal"
            >
              QR-SPOTCHECK-APEX-CHL01
            </button>
            <button
              type="button"
              onClick={() => handleQuickToken('QR-SPOTCHECK-APEX-ELEC01')}
              className="px-2.5 py-1 text-xs font-mono bg-sand-light hover:bg-sand border border-warm rounded text-charcoal"
            >
              QR-SPOTCHECK-APEX-ELEC01
            </button>
            <button
              type="button"
              onClick={() => handleQuickToken('QR-SPOTCHECK-METRO-FIRE01')}
              className="px-2.5 py-1 text-xs font-mono bg-sand-light hover:bg-sand border border-warm rounded text-charcoal"
            >
              QR-SPOTCHECK-METRO-FIRE01
            </button>
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-md bg-crimson-bg border border-[#F2D6D3] flex items-center gap-3 text-xs text-crimson font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Verified Checkpoint Card */}
      {checkpoint && (
        <Card padding="md" className="border-sage bg-[#FAFBF9] space-y-4 animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-sage-bg text-sage flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-sage uppercase tracking-wider">
                  Checkpoint Verified
                </span>
                <h3 className="text-base font-bold text-charcoal">{checkpoint.name}</h3>
              </div>
            </div>
            <Badge variant="sand" size="sm">
              {checkpoint.code}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-warm">
            <div className="flex items-center gap-2 text-muted">
              <Building className="w-4 h-4 text-terracotta" />
              <span>
                Facility: <strong className="text-charcoal">{checkpoint.facilityName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Layers className="w-4 h-4 text-terracotta" />
              <span>
                Zone: <strong className="text-charcoal">{checkpoint.zoneName}</strong>
              </span>
            </div>
          </div>

          {checkpoint.instructions && (
            <div className="p-3 bg-white border border-warm rounded text-xs text-charcoal">
              <span className="font-semibold block text-[11px] text-muted uppercase mb-1">
                Field Inspection Instructions:
              </span>
              <p>{checkpoint.instructions}</p>
            </div>
          )}

          <div className="pt-2">
            <Button
              fullWidth
              variant="primary"
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={() => {
                navigate(
                  `/inspections/new?facilityId=${checkpoint.facilityId}&checkpointId=${checkpoint.id}&zoneId=${checkpoint.zoneId}`
                );
              }}
            >
              Launch Inspection for This Checkpoint
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
