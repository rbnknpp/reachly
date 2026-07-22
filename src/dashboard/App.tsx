import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { AgencyPage } from "@/pages/AgencyPage";
import { AgencyClientDetailPage } from "@/pages/AgencyClientDetailPage";
import { InboxPage } from "@/pages/InboxPage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { StatsPage } from "@/pages/StatsPage";
import { ClientSettingsPage } from "@/pages/ClientSettingsPage";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";

function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === "agency" ? "/agency" : "/inbox"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<RoleHome />} />
          <Route
            path="/agency"
            element={
              <ProtectedRoute allow={["agency"]}>
                <AgencyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agency/:clientId"
            element={
              <ProtectedRoute allow={["agency"]}>
                <AgencyClientDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allow={["client"]}>
                <ClientSettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
