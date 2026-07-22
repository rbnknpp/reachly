import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import { formatDate } from "@/lib/utils";

export interface KpiSummary {
  missedCalls: number;
  smsSent: number;
  converted: number;
  conversionRate: number;
  conversations: number;
  appointments: number;
  reviewsSent: number;
}

export interface DailyPoint {
  date: string;
  missedCalls: number;
  conversions: number;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function useStats(clientId: string | undefined | "all", days: number) {
  return useQuery({
    queryKey: ["stats", clientId, days],
    enabled: !!clientId,
    queryFn: async (): Promise<{ summary: KpiSummary; series: DailyPoint[] }> => {
      const since = daysAgoIso(days);

      let missedCallsQuery = supabase.from("missed_calls").select("status, created_at").gte("created_at", since);
      let conversationsQuery = supabase.from("conversations").select("id", { count: "exact", head: true }).gte("updated_at", since);
      let appointmentsQuery = supabase.from("appointments").select("id", { count: "exact", head: true }).gte("starts_at", since);
      let reviewsQuery = supabase.from("review_requests").select("id", { count: "exact", head: true }).eq("status", "sent").gte("scheduled_for", since);

      if (clientId && clientId !== "all") {
        missedCallsQuery = missedCallsQuery.eq("client_id", clientId);
        conversationsQuery = conversationsQuery.eq("client_id", clientId);
        appointmentsQuery = appointmentsQuery.eq("client_id", clientId);
        reviewsQuery = reviewsQuery.eq("client_id", clientId);
      }

      const [missedCallsRes, conversationsRes, appointmentsRes, reviewsRes] = await Promise.all([
        missedCallsQuery,
        conversationsQuery,
        appointmentsQuery,
        reviewsQuery,
      ]);

      if (missedCallsRes.error) throw missedCallsRes.error;
      if (conversationsRes.error) throw conversationsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      const missedCalls = missedCallsRes.data ?? [];
      const smsSent = missedCalls.filter((m) => m.status === "sms_sent" || m.status === "converted").length;
      const converted = missedCalls.filter((m) => m.status === "converted").length;

      const byDay = new Map<string, DailyPoint>();
      for (const call of missedCalls) {
        const key = formatDate(call.created_at);
        const point = byDay.get(key) ?? { date: key, missedCalls: 0, conversions: 0 };
        point.missedCalls += 1;
        if (call.status === "converted") point.conversions += 1;
        byDay.set(key, point);
      }

      return {
        summary: {
          missedCalls: missedCalls.length,
          smsSent,
          converted,
          conversionRate: smsSent > 0 ? converted / smsSent : 0,
          conversations: conversationsRes.count ?? 0,
          appointments: appointmentsRes.count ?? 0,
          reviewsSent: reviewsRes.count ?? 0,
        },
        series: Array.from(byDay.values()),
      };
    },
  });
}
