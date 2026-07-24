import * as React from "react";
import { CheckCircle2, XCircle, Ban, CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/useAppointments";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { AppointmentStatus } from "@schema/database";

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "secondary" | "success" | "destructive" | "warning"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "warning",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Ausstehend",
  confirmed: "Bestätigt",
  completed: "Erledigt",
  cancelled: "Abgesagt",
  no_show: "Nicht erschienen",
};

export function AppointmentsPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? undefined;
  const [tab, setTab] = React.useState<"upcoming" | "past">("upcoming");
  const { data: appointments, isLoading } = useAppointments(clientId, tab);
  const updateStatus = useUpdateAppointmentStatus(clientId);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Termine</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming">Kommend</TabsTrigger>
            <TabsTrigger value="past">Vergangen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Termine, die Kunden über das Widget gebucht haben oder die manuell im Kalender eingetragen wurden.
      </p>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Zeit</TableHead>
              <TableHead>Status</TableHead>
              {tab === "upcoming" && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Lädt …
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (appointments ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarClock className="h-6 w-6 text-muted-foreground/50" />
                    {tab === "upcoming"
                      ? "Keine anstehenden Termine."
                      : "Noch keine vergangenen Termine."}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {(appointments ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.end_customers?.name || a.end_customers?.phone || "Unbekannt"}</TableCell>
                <TableCell>{a.title}</TableCell>
                <TableCell>{formatDateTime(a.starts_at)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </TableCell>
                {tab === "upcoming" && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Erledigt"
                        onClick={() => updateStatus.mutate({ id: a.id, status: "completed" })}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Nicht erschienen"
                        onClick={() => updateStatus.mutate({ id: a.id, status: "no_show" })}
                      >
                        <XCircle className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Absagen"
                        onClick={() => updateStatus.mutate({ id: a.id, status: "cancelled" })}
                      >
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
