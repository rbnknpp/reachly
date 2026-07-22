import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Mail } from "lucide-react";
import { toast } from "sonner";
import { useClients, useCreateClient, useInviteClientUser, useClientOwnerProfiles } from "@/hooks/useClients";
import { useStats } from "@/hooks/useStats";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Client } from "@schema/database";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ClientKpis({ clientId }: { clientId: string }) {
  const { data, isLoading } = useStats(clientId, 30);
  if (isLoading || !data) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>{data.summary.missedCalls} verpasste Anrufe</span>
      <span>{Math.round(data.summary.conversionRate * 100)}% Conversion</span>
      <span>{data.summary.conversations} Konversationen</span>
      <span>{data.summary.appointments} Termine</span>
      <span>{data.summary.reviewsSent} Reviews</span>
    </div>
  );
}

function InviteDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inviteUser = useInviteClientUser();
  const [email, setEmail] = React.useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await inviteUser.mutateAsync({ client_id: clientId, email, display_name: clientName });
      toast.success(`Einladung an ${email} verschickt`);
      onOpenChange(false);
      setEmail("");
    } catch (err) {
      toast.error("Einladung fehlgeschlagen", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Login für „{clientName}“ einladen</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleInvite}>
        <DialogContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">E-Mail-Adresse des Inhabers</Label>
            <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={inviteUser.isPending}>
            {inviteUser.isPending ? "Verschickt …" : "Einladung verschicken"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export function AgencyPage() {
  const { data: clients, isLoading } = useClients();
  const { data: ownerProfiles } = useClientOwnerProfiles();
  const createClient = useCreateClient();
  const inviteUser = useInviteClientUser();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [inviteTarget, setInviteTarget] = React.useState<Client | null>(null);

  const clientsWithLogin = React.useMemo(
    () => new Set((ownerProfiles ?? []).map((p) => p.client_id).filter(Boolean)),
    [ownerProfiles],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const client = await createClient.mutateAsync({ name, slug: slug || slugify(name) });
      toast.success(`Mandant „${client.name}“ angelegt`);

      if (email.trim()) {
        try {
          await inviteUser.mutateAsync({ client_id: client.id, email: email.trim(), display_name: name });
          toast.success(`Einladung an ${email.trim()} verschickt`);
        } catch (inviteErr) {
          toast.error("Mandant angelegt, aber Einladung fehlgeschlagen", { description: (inviteErr as Error).message });
        }
      }

      setDialogOpen(false);
      setName("");
      setSlug("");
      setEmail("");
      navigate(`/agency/${client.id}`);
    } catch (err) {
      toast.error("Mandant konnte nicht angelegt werden", { description: (err as Error).message });
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mandanten</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Mandant anlegen
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>KPIs (30 Tage)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Lädt …
                </TableCell>
              </TableRow>
            )}
            {(clients ?? []).map((client: Client) => (
              <TableRow key={client.id}>
                <TableCell className="cursor-pointer font-medium" onClick={() => navigate(`/agency/${client.id}`)}>
                  {client.name}
                </TableCell>
                <TableCell>
                  <Badge variant={client.active ? "success" : "secondary"}>{client.active ? "Aktiv" : "Inaktiv"}</Badge>
                </TableCell>
                <TableCell>
                  {clientsWithLogin.has(client.id) ? (
                    <Badge variant="success">Login aktiv</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInviteTarget(client);
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Kein Login
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <ClientKpis clientId={client.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader onClose={() => setDialogOpen(false)}>
          <DialogTitle>Neuen Mandanten anlegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate}>
          <DialogContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-slug">Slug (data-key fürs Widget)</Label>
              <Input id="client-slug" required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-email">E-Mail des Inhabers (optional)</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="inhaber@betrieb.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? "Anlegen …" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {inviteTarget && (
        <InviteDialog
          clientId={inviteTarget.id}
          clientName={inviteTarget.name}
          open={!!inviteTarget}
          onOpenChange={(open) => {
            if (!open) setInviteTarget(null);
          }}
        />
      )}
    </div>
  );
}
