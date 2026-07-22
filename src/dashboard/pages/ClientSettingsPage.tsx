import { useAuth } from "@/hooks/useAuth";
import { ClientSettingsForm } from "@/components/ClientSettingsForm";

export function ClientSettingsPage() {
  const { profile } = useAuth();

  if (!profile?.client_id) {
    return <div className="text-sm text-muted-foreground">Kein Mandant zugeordnet.</div>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Einstellungen</h1>
      <ClientSettingsForm clientId={profile.client_id} variant="client" />
    </div>
  );
}
