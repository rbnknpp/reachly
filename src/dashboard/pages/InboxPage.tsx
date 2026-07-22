import { useAuth } from "@/hooks/useAuth";
import { Inbox } from "@/components/Inbox";

export function InboxPage() {
  const { profile } = useAuth();
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Posteingang</h1>
      <Inbox clientId={profile?.client_id ?? undefined} />
    </div>
  );
}
