import * as React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
import { InfoPage } from "@/pages/InfoPage";
import { FaqPage } from "@/pages/FaqPage";

function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === "agency" ? "/agency" : "/inbox"} replace />;
}

// Zeigt bei einem Passwort-Reset-Link (type=recovery) das Passwort-Formular,
// statt die bereits durch den Recovery-Token hergestellte Session direkt
// ins Dashboard weiterzuleiten.
function RecoveryRedirect() {
  const { passwordRecovery } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (passwordRecovery) {
      navigate("/accept-invite", { replace: true });
    }
  }, [passwordRecovery, navigate]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <RecoveryRedirect />
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
          <Route path="/info" element={<InfoPage />} />
          <Route path="/hilfe" element={<FaqPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
