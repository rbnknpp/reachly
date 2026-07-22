import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@schema/database";

interface Props {
  children: React.ReactNode;
  allow?: UserRole[];
}

export function ProtectedRoute({ children, allow }: Props) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Lädt …</div>;
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to={profile.role === "agency" ? "/agency" : "/inbox"} replace />;
  }

  return <>{children}</>;
}
