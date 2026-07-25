// POST /functions/v1/widget-lead
// Body: { key, name, phone, concern? }
// Legt end_customer (falls neu) + eine neue Konversation (Kanal 'sms') +
// die Lead-Nachricht als erste eingehende Nachricht an.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { generateAndSendAiReply } from "../_shared/ai.ts";

interface LeadBody {
  key?: string;
  name?: string;
  phone?: string;
  concern?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: LeadBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const key = body.key?.trim();
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const concern = body.concern?.trim();

  if (!key || !name || !phone) {
    return jsonResponse({ error: "key, name und phone sind erforderlich" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_client_key: key,
    p_action: "widget-lead",
    p_max_requests: 10,
    p_window_seconds: 300,
  });
  if (!allowed) return jsonResponse({ error: "Rate limit erreicht" }, 429);

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", key)
    .eq("active", true)
    .maybeSingle();
  if (!client) return jsonResponse({ error: "Unbekannter oder inaktiver Mandant" }, 404);

  const { data: endCustomer, error: ecError } = await supabase
    .from("end_customers")
    .upsert({ client_id: client.id, phone, name }, { onConflict: "client_id,phone" })
    .select("id")
    .single();
  if (ecError || !endCustomer) {
    return jsonResponse({ error: "Kunde konnte nicht angelegt werden" }, 500);
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      client_id: client.id,
      end_customer_id: endCustomer.id,
      channel: "sms",
      status: "ai_active",
      last_inbound_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (convError || !conversation) {
    return jsonResponse({ error: "Konversation konnte nicht angelegt werden" }, 500);
  }

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    sender: "customer",
    body: concern || "Rückruf angefordert (kein Anliegen angegeben).",
  });
  if (msgError) {
    return jsonResponse({ error: "Nachricht konnte nicht gespeichert werden" }, 500);
  }

  // Bewusst awaited statt "fire and forget": Deno Edge Functions koennen nach
  // der Response jederzeit beendet werden, ein nicht abgewarteter Aufruf
  // wuerde also riskieren, dass die KI-Antwort nie fertig verarbeitet wird.
  await generateAndSendAiReply(supabase, conversation.id);

  return jsonResponse({ ok: true });
});
