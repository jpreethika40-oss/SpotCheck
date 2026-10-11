import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FacilitiesList } from './pages/facilities/FacilitiesList';
import { FacilityDetail } from './pages/facilities/FacilityDetail';
import { CheckpointScan } from './pages/checkpoints/CheckpointScan';
import { AssetsList } from './pages/assets/AssetsList';
import { AssetDetail } from './pages/assets/AssetDetail';
import { TemplatesList } from './pages/templates/TemplatesList';
import { TemplateBuilder } from './pages/templates/TemplateBuilder';
import { SchedulesList } from './pages/schedules/SchedulesList';
import { InspectionsList } from './pages/inspections/InspectionsList';
import { InspectionExecution } from './pages/inspections/InspectionExecution';
import { InspectionDetail } from './pages/inspections/InspectionDetail';
import { WorkOrdersList } from './pages/work-orders/WorkOrdersList';
import { WorkOrderDetail } from './pages/work-orders/WorkOrderDetail';
import { ConflictReview } from './pages/conflicts/ConflictReview';
import { SyncDiagnostics } from './pages/sync/SyncDiagnostics';
import { AnalyticsReports } from './pages/analytics/AnalyticsReports';
import { AuditHistory } from './pages/audit/AuditHistory';
import { UsersList } from './pages/users/UsersList';
import { ProfileSettings } from './pages/profile/ProfileSettings';
import { NotFound } from './pages/NotFound';
import { Skeleton } from './components/common/Skeleton';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="facilities" element={<FacilitiesList />} />
        <Route path="facilities/:id" element={<FacilityDetail />} />
        <Route path="checkpoints/scan" element={<CheckpointScan />} />
        <Route path="assets" element={<AssetsList />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="templates" element={<TemplatesList />} />
        <Route path="templates/new" element={<TemplateBuilder />} />
        <Route path="templates/:id" element={<TemplateBuilder />} />
        <Route path="schedules" element={<SchedulesList />} />
        <Route path="inspections" element={<InspectionsList />} />
        <Route path="inspections/new" element={<InspectionExecution />} />
        <Route path="inspections/run/:id" element={<InspectionExecution />} />
        <Route path="inspections/:id" element={<InspectionDetail />} />
        <Route path="work-orders" element={<WorkOrdersList />} />
        <Route path="work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="conflicts" element={<ConflictReview />} />
        <Route path="sync-diagnostics" element={<SyncDiagnostics />} />
        <Route path="analytics" element={<AnalyticsReports />} />
        <Route path="audit" element={<AuditHistory />} />
        <Route path="users" element={<UsersList />} />
        <Route path="profile" element={<ProfileSettings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};
