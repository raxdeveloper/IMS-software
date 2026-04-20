import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { PageSkeleton } from "./components/ui/PageSkeleton";

const LoginPage = lazy(() => import("./pages/Login").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const PatientListPage = lazy(() => import("./pages/patients/PatientListPage").then((m) => ({ default: m.PatientListPage })));
const PatientNewPage = lazy(() => import("./pages/patients/PatientNewPage").then((m) => ({ default: m.PatientNewPage })));
const PatientEditPage = lazy(() => import("./pages/patients/PatientEditPage").then((m) => ({ default: m.PatientEditPage })));
const PatientProfilePage = lazy(() => import("./pages/patients/PatientProfilePage").then((m) => ({ default: m.PatientProfilePage })));
const AppointmentsPage = lazy(() => import("./pages/appointments/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })));
const OrderListPage = lazy(() => import("./pages/orders/OrderListPage").then((m) => ({ default: m.OrderListPage })));
const OrderWizardPage = lazy(() => import("./pages/orders/OrderWizardPage").then((m) => ({ default: m.OrderWizardPage })));
const OrderDetailPage = lazy(() => import("./pages/orders/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const PrescriptionNewPage = lazy(() => import("./pages/prescriptions/PrescriptionNewPage").then((m) => ({ default: m.PrescriptionNewPage })));
const PrescriptionDetailPage = lazy(() => import("./pages/prescriptions/PrescriptionDetailPage").then((m) => ({ default: m.PrescriptionDetailPage })));
const PrescriptionEditPage = lazy(() => import("./pages/prescriptions/PrescriptionEditPage").then((m) => ({ default: m.PrescriptionEditPage })));
const PrescriptionHistoryPage = lazy(() => import("./pages/prescriptions/PrescriptionHistoryPage").then((m) => ({ default: m.PrescriptionHistoryPage })));
const FrameListPage = lazy(() => import("./pages/frames/FrameListPage").then((m) => ({ default: m.FrameListPage })));
const FrameFormPage = lazy(() => import("./pages/frames/FrameFormPage").then((m) => ({ default: m.FrameFormPage })));
const LensesPage = lazy(() => import("./pages/lenses/LensesPage").then((m) => ({ default: m.LensesPage })));
const SpectacleLensFormPage = lazy(() => import("./pages/lenses/SpectacleLensFormPage").then((m) => ({ default: m.SpectacleLensFormPage })));
const ContactLensFormPage = lazy(() => import("./pages/lenses/ContactLensFormPage").then((m) => ({ default: m.ContactLensFormPage })));
const HealthDeploymentPage = lazy(() => import("./pages/admin/HealthDeploymentPage").then((m) => ({ default: m.HealthDeploymentPage })));

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientListPage />} />
          <Route
            path="patients/new"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <PatientNewPage />
              </ProtectedRoute>
            }
          />
          <Route path="patients/:id/prescriptions" element={<PrescriptionHistoryPage />} />
          <Route path="patients/:id" element={<PatientProfilePage />} />
          <Route path="frames" element={<FrameListPage />} />
          <Route
            path="frames/new"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <FrameFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="frames/:id/edit" element={<FrameFormPage />} />
          <Route path="lenses" element={<LensesPage />} />
          <Route
            path="lenses/spectacle/new"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <SpectacleLensFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="lenses/spectacle/:id/edit" element={<SpectacleLensFormPage />} />
          <Route
            path="lenses/contact/new"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <ContactLensFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="lenses/contact/:id/edit" element={<ContactLensFormPage />} />
          <Route path="prescriptions/new" element={<PrescriptionNewPage />} />
          <Route path="prescriptions/:id" element={<PrescriptionDetailPage />} />
          <Route path="prescriptions/:id/edit" element={<PrescriptionEditPage />} />
          <Route
            path="patients/:id/edit"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <PatientEditPage />
              </ProtectedRoute>
            }
          />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route
            path="orders/new"
            element={
              <ProtectedRoute roles={["admin", "staff"]}>
                <OrderWizardPage />
              </ProtectedRoute>
            }
          />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route
            path="settings"
            element={
              <ProtectedRoute roles={["admin", "doctor", "staff"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/health"
            element={
              <ProtectedRoute roles={["admin", "doctor", "staff"]}>
                <HealthDeploymentPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="admin" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
