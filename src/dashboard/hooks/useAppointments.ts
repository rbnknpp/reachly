import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import type { AppointmentStatus, AppointmentWithCustomer } from "@schema/database";

export function useAppointments(clientId: string | undefined, scope: "upcoming" | "past") {
  return useQuery({
    queryKey: ["appointments", clientId, scope],
    enabled: !!clientId,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("appointments")
        .select("*, end_customers(id, name, phone)")
        .eq("client_id", clientId!);

      q = scope === "upcoming" ? q.gte("starts_at", nowIso).order("starts_at", { ascending: true }) : q.lt("starts_at", nowIso).order("starts_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      return data as AppointmentWithCustomer[];
    },
  });
}

export function useUpdateAppointmentStatus(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments", clientId] });
    },
  });
}
