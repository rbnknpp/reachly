import * as React from "react";
import { useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useClient, useClientSettings } from "@/hooks/useClients";
import { Inbox } from "@/components/Inbox";
import { ClientSettingsForm } from "@/components/ClientSettingsForm";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function EmbedCodeBox({ slug }: { slug: string }) {
  const [copied, setCopied] = React.useState(false);
  const snippet = `<script src="https://cdn.reachly.app/widget.js" data-key="${slug}" async></script>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Embed-Code kopiert");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed-Code</CardTitle>
        <CardDescription>Diese eine Zeile auf der Kundenwebsite einfügen – das ist der Auslieferungsweg.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-muted px-3 py-2 text-xs">{snippet}</code>
          <Button size="icon" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type View = "inbox" | "settings" | "onboarding";

export function AgencyClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: client } = useClient(clientId);
  const { data: settings } = useClientSettings(clientId);
  const [tab, setTab] = React.useState<View | null>(null);

  // Ein frisch angelegter Mandant hat noch keinerlei Kontaktdaten - dann
  // starten wir direkt mit der gefuehrten Einrichtung statt dem leeren
  // Posteingang. Sobald einmal eine Wahl getroffen wurde (auch durch
  // Ueberspringen), bleibt die manuelle Tab-Auswahl massgeblich.
  React.useEffect(() => {
    if (tab !== null || !settings) return;
    const isUnconfigured = !settings.business_phone && !settings.wa_business_number && !settings.calcom_event_type_id;
    setTab(isUnconfigured ? "onboarding" : "inbox");
  }, [settings, tab]);

  if (!clientId) return null;
  if (tab === null) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{client?.name ?? "Mandant"}</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as View)}>
          <TabsList>
            <TabsTrigger value="onboarding">Einrichtung</TabsTrigger>
            <TabsTrigger value="inbox">Posteingang</TabsTrigger>
            <TabsTrigger value="settings">Einstellungen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "onboarding" && <OnboardingWizard clientId={clientId} onDone={() => setTab("inbox")} />}
      {tab === "inbox" && <Inbox clientId={clientId} />}
      {tab === "settings" && (
        <div className="flex flex-col gap-4">
          {client && <EmbedCodeBox slug={client.slug} />}
          <ClientSettingsForm clientId={clientId} variant="agency" />
        </div>
      )}
    </div>
  );
}
