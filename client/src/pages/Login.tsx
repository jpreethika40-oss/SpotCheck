import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, AlertCircle, ArrowRight, UserCheck, Wrench, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('manager@spotcheck.io');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Invalid email or password.');
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-lg bg-charcoal-nav flex items-center justify-center text-white font-bold text-lg shadow-card border border-warm">
          <span className="text-terracotta">S</span>C
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-charcoal">
          SpotCheck Platform
        </h2>
        <p className="mt-1 text-xs text-muted">
          Offline-First Facility Inspection & Maintenance Architecture
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface py-8 px-6 sm:px-8 rounded-lg border border-warm shadow-card">
          {error && (
            <div className="mb-5 p-3 rounded-md bg-crimson-bg border border-[#F2D6D3] flex items-center gap-2 text-xs text-crimson font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="technician@spotcheck.io"
            />

            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <div className="pt-2">
              <Button type="submit" fullWidth loading={loading} icon={<ArrowRight className="w-4 h-4" />}>
                Sign In to SpotCheck
              </Button>
            </div>
          </form>

          {/* Quick Demo Role Selector */}
          <div className="mt-6 pt-6 border-t border-warm">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 text-center">
              Quick Role Login (Development Mode)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('manager@spotcheck.io')}
                className={`p-2 rounded border text-left transition-all text-xs flex flex-col items-center justify-center text-center ${
                  email === 'manager@spotcheck.io'
                    ? 'border-terracotta bg-terracotta/5 font-semibold text-charcoal'
                    : 'border-warm bg-[#FCFAF6] hover:bg-sand/30 text-muted'
                }`}
              >
                <Shield className="w-4 h-4 mb-1 text-terracotta" />
                <span>Manager</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('inspector@spotcheck.io')}
                className={`p-2 rounded border text-left transition-all text-xs flex flex-col items-center justify-center text-center ${
                  email === 'inspector@spotcheck.io'
                    ? 'border-terracotta bg-terracotta/5 font-semibold text-charcoal'
                    : 'border-warm bg-[#FCFAF6] hover:bg-sand/30 text-muted'
                }`}
              >
                <UserCheck className="w-4 h-4 mb-1 text-sage" />
                <span>Inspector</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('tech@spotcheck.io')}
                className={`p-2 rounded border text-left transition-all text-xs flex flex-col items-center justify-center text-center ${
                  email === 'tech@spotcheck.io'
                    ? 'border-terracotta bg-terracotta/5 font-semibold text-charcoal'
                    : 'border-warm bg-[#FCFAF6] hover:bg-sand/30 text-muted'
                }`}
              >
                <Wrench className="w-4 h-4 mb-1 text-amber" />
                <span>Technician</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
          <span>Local IndexedDB and Service Worker Active</span>
        </div>
      </div>
    </div>
  );
};
