import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import type { Client, ClientSettings, Profile } from "@schema/database";

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).single();
      if (error) throw error;
      return data as Client;
    },
  });
}

export function useClientSettings(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_settings", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_settings")
        .select("*")
        .eq("client_id", clientId!)
        .single();
      if (error) throw error;
      return data as ClientSettings;
    },
  });
}

export function useUpdateClientSettings(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ClientSettings>) => {
      const { error } = await supabase.from("client_settings").update(patch).eq("client_id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["client_settings", clientId] });
    },
  });
}

export function useInviteClientUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; email: string; display_name?: string }) => {
      const { data, error } = await supabase.functions.invoke("invite-client-user", { body: input });
      if (error) throw error;
      return data as { ok: true; user_id: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profiles", "client-owners"] });
    },
  });
}

export function useClientOwnerProfiles() {
  return useQuery({
    queryKey: ["profiles", "client-owners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("client_id, display_name").eq("role", "client");
      if (error) throw error;
      return data as Pick<Profile, "client_id" | "display_name">[];
    },
  });
}

export function useProvisionTwilioNumber(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("provision-twilio-number", {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data as { ok: true; phone_number: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["client_settings", clientId] });
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({ name: input.name, slug: input.slug, active: true })
        .select()
        .single();
      if (clientError) throw clientError;

      const { error: settingsError } = await supabase.from("client_settings").insert({
        client_id: (client as Client).id,
        timezone: "Europe/Berlin",
        review_delay_hours: 48,
        ai_enabled: true,
      });
      if (settingsError) throw settingsError;

      return client as Client;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
