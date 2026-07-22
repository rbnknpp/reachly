// POST /functions/v1/send-manual-reply
// Body: { conversation_id, body }
// Wird vom Dashboard mit dem JWT des eingeloggten Users aufgerufen
// (supabase.functions.invoke haengt das automatisch an). Autorisierung laeuft
// bewusst ueber RLS: die Konversation wird mit einem User-scoped Client
// gelesen, sodass nur sichtbar ist, was der/die Eingeloggte laut RLS auch
// sehen darf (agency: alles, client: nur der eigene Mandant).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface ReplyBody {
  conversation_id?: string;
  body?: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Nicht angemeldet" }, 401);

  let body: ReplyBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const conversationId = body.conversation_id?.trim();
  const replyText = body.body?.trim();
  if (!conversationId || !replyText) {
    return jsonResponse({ error: "conversation_id und body sind erforderlich" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User-scoped Client: RLS entscheidet, ob die Konversation sichtbar ist.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: conversation, error: convError } = await userClient
    .from("conversations")
    .select("id, client_id, channel, last_inbound_at, end_customers(wa_id, phone)")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    return jsonResponse({ error: "Konversation nicht gefunden oder kein Zugriff" }, 404);
  }

  if (conversation.channel !== "whatsapp") {
    return jsonResponse({ error: "Manuelle Antworten sind aktuell nur für WhatsApp-Konversationen möglich" }, 400);
  }

  if (!conversation.last_inbound_at || Date.now() - new Date(conversation.last_inbound_at).getTime() > TWENTY_FOUR_HOURS_MS) {
    return jsonResponse({ error: "WhatsApp-24h-Fenster abgelaufen - Freitext nicht mehr möglich" }, 409);
  }

  const endCustomer = conversation.end_customers as unknown as { wa_id: string | null; phone: string } | null;
  const waId = endCustomer?.wa_id;
  if (!waId) {
    return jsonResponse({ error: "Keine WhatsApp-ID für diesen Kunden hinterlegt" }, 400);
  }

  // Ab hier mit service_role: client_settings/-secrets lesen und die
  // ausgehende Nachricht speichern (messages hat bewusst keine INSERT-Policy
  // fuer eingeloggte User - nur Backend darf schreiben).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await adminClient
    .from("client_settings")
    .select("wa_phone_number_id")
    .eq("client_id", conversation.client_id)
    .maybeSingle();
  const { data: secrets } = await adminClient
    .from("client_integration_secrets")
    .select("wa_access_token")
    .eq("client_id", conversation.client_id)
    .maybeSingle();

  if (!settings?.wa_phone_number_id || !secrets?.wa_access_token) {
    return jsonResponse({ error: "WhatsApp ist für diesen Mandanten nicht verbunden" }, 404);
  }

  // WhatsApp Cloud API (Meta Graph API). Erfordert ein aktives WhatsApp-
  // Business-Konto mit verifizierter Nummer und Zugriffstoken - beides nicht
  // Teil dieses Repos, muss separat im Meta Business Manager eingerichtet
  // und ueber client_integration_secrets.wa_access_token hinterlegt werden.
  const waResponse = await fetch(`https://graph.facebook.com/v20.0/${settings.wa_phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secrets.wa_access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: waId,
      type: "text",
      text: { body: replyText },
    }),
  });

  if (!waResponse.ok) {
    console.error("send-manual-reply: WhatsApp API Fehler", await waResponse.text());
    return jsonResponse({ error: "Nachricht konnte nicht über WhatsApp gesendet werden" }, 502);
  }

  const waJson = await waResponse.json();
  const waMessageId: string | undefined = waJson?.messages?.[0]?.id;

  const { error: msgError } = await adminClient.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    sender: "human",
    body: replyText,
    wa_message_id: waMessageId ?? null,
  });
  if (msgError) {
    console.error("send-manual-reply: Nachricht konnte nicht gespeichert werden", msgError);
    return jsonResponse({ error: "Nachricht wurde gesendet, aber nicht gespeichert" }, 500);
  }

  return jsonResponse({ ok: true });
});
