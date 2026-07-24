// POST /functions/v1/email-inbound — nimmt eingehende E-Mails als JSON an
// und legt sie als Konversation (channel=email) in den Posteingang.
//
// Bewusst provider-neutral: Cloudflare Email Routing (Worker), Mailgun
// Routes oder jeder andere Dienst, der einen HTTP-POST schicken kann,
// liefert hier an. Erwartetes JSON:
//   { "to": "info@betrieb.de", "from": "kunde@web.de",
//     "from_name": "Max Kunde", "subject": "...", "text": "..." }
//
// Zuordnung zum Mandanten ueber client_settings.inbound_email_address == to.
// Autorisierung ueber Header x-inbound-secret (mit --no-verify-jwt deployen).
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("EMAIL_INBOUND_SECRET");
  if (!secret || req.headers.get("x-inbound-secret") !== secret) {
    return jsonResponse({ error: "Nicht autorisiert" }, 401);
  }

  let body: {
    to?: string;
    from?: string;
    from_name?: string;
    subject?: string;
    text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const to = body.to?.trim().toLowerCase();
  const from = body.from?.trim().toLowerCase();
  const text = [body.subject?.trim(), body.text?.trim()].filter(Boolean).join("\n\n");
  if (!to || !from || !text) {
    return jsonResponse({ error: "to, from und subject/text sind erforderlich" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await admin
    .from("client_settings")
    .select("client_id")
    .ilike("inbound_email_address", to)
    .maybeSingle();
  if (!settings) {
    // 200 statt 404: Provider sollen nicht endlos retryen, wenn eine Adresse
    // (noch) keinem Mandanten zugeordnet ist.
    console.warn(`email-inbound: keine Zuordnung fuer ${to}`);
    return jsonResponse({ ok: true, matched: false });
  }

  // end_customers verlangt eine Telefonnummer (Schema-Altlast aus der
  // Anruf-Welt) - fuer reine E-Mail-Kontakte dient die Adresse als
  // eindeutiger Schluessel im phone-Feld.
  const pseudoPhone = `mail:${from}`;
  const { data: existingCustomer } = await admin
    .from("end_customers")
    .select("id")
    .eq("client_id", settings.client_id)
    .eq("phone", pseudoPhone)
    .maybeSingle();

  let endCustomerId = existingCustomer?.id as string | undefined;
  if (!endCustomerId) {
    const { data: created, error } = await admin
      .from("end_customers")
      .insert({
        client_id: settings.client_id,
        phone: pseudoPhone,
        name: body.from_name?.trim() || from,
      })
      .select("id")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    endCustomerId = created.id;
  }

  const { data: openConv } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", settings.client_id)
    .eq("end_customer_id", endCustomerId)
    .eq("channel", "email")
    .neq("status", "closed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = openConv?.id as string | undefined;
  if (!conversationId) {
    const { data: newConv, error } = await admin
      .from("conversations")
      .insert({
        client_id: settings.client_id,
        end_customer_id: endCustomerId,
        channel: "email",
        // E-Mails beantwortet der Betrieb selbst - kein KI-Autopilot,
        // solange es keinen E-Mail-Versandweg gibt.
        status: "human_handoff",
      })
      .select("id")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversationId = newConv.id;
  }

  await admin.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    sender: "customer",
    body: text,
  });
  await admin
    .from("conversations")
    .update({ last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return jsonResponse({ ok: true, matched: true });
});
