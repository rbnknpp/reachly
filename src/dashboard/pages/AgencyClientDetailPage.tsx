import * as React from "react";
import { useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useClient } from "@/hooks/useClients";
import { Inbox } from "@/components/Inbox";
import { ClientSettingsForm } from "@/components/ClientSettingsForm";
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

export function AgencyClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: client } = useClient(clientId);
  const [tab, setTab] = React.useState<"inbox" | "settings">("inbox");

  if (!clientId) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{client?.name ?? "Mandant"}</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "settings")}>
          <TabsList>
            <TabsTrigger value="inbox">Posteingang</TabsTrigger>
            <TabsTrigger value="settings">Einstellungen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "inbox" ? (
        <Inbox clientId={clientId} />
      ) : (
        <div className="flex flex-col gap-4">
          {client && <EmbedCodeBox slug={client.slug} />}
          <ClientSettingsForm clientId={clientId} variant="agency" />
        </div>
      )}
    </div>
  );
}
