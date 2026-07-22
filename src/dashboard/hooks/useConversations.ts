import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import type { Conversation, ConversationWithCustomer, Message } from "@schema/database";

export function useConversations(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, end_customers(id, name, phone)")
        .eq("client_id", clientId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ConversationWithCustomer[];
    },
  });

  // Realtime: neue/aktualisierte Konversationen des Mandanten live nachziehen.
  React.useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`conversations:${clientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `client_id=eq.${clientId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["conversations", clientId] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `client_id=eq.${clientId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["conversations", clientId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return query;
}

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  React.useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useUpdateConversationStatus(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Conversation["status"] }) => {
      const { error } = await supabase.from("conversations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", clientId] });
    },
  });
}

export function useSendManualReply() {
  return useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const { error } = await supabase.functions.invoke("send-manual-reply", {
        body: { conversation_id: conversationId, body },
      });
      if (error) throw error;
    },
  });
}
