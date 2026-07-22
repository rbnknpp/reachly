import * as React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useStats } from "@/hooks/useStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PERIODS = [7, 30, 90] as const;

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-[28px] font-semibold leading-none text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

export function StatsPage() {
  const { profile } = useAuth();
  const isAgency = profile?.role === "agency";
  const { data: clients } = useClients();
  const [selectedClientId, setSelectedClientId] = React.useState<string | "all">("all");
  const [days, setDays] = React.useState<(typeof PERIODS)[number]>(30);

  const clientId = isAgency ? selectedClientId : (profile?.client_id ?? undefined);
  const { data, isLoading } = useStats(clientId, days);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Statistik</h1>
        <div className="flex items-center gap-3">
          {isAgency && (
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="all">Alle Mandanten</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as (typeof PERIODS)[number])}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p} value={String(p)}>
                  {p} Tage
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Lädt …</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Verpasste Anrufe" value={String(data.summary.missedCalls)} />
            <KpiCard label="Conversion-Rate" value={`${Math.round(data.summary.conversionRate * 100)}%`} />
            <KpiCard label="Konversationen" value={String(data.summary.conversations)} />
            <KpiCard label="Termine" value={String(data.summary.appointments)} />
            <KpiCard label="Bewertungen" value={String(data.summary.reviewsSent)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Verpasste Anrufe vs. Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="missedCalls" name="Verpasste Anrufe" stroke="#64748b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="conversions" name="Conversions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
