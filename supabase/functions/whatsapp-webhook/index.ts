// POST /functions/v1/whatsapp-webhook  — Meta-Webhook fuer eingehende
// WhatsApp-Nachrichten. GET dient der einmaligen Webhook-Verifizierung
// durch Meta (hub.challenge).
//
// Ablauf pro eingehender Textnachricht:
//   1. Mandant ueber die empfangende Nummer (metadata.phone_number_id) finden
//   2. Endkunde + Konversation anlegen/aktualisieren, Nachricht speichern
//   3. Wenn ai_enabled und Konversation auf ai_active: Claude beantwortet die
//      Nachricht (Tools: freie Termine abfragen, Termin buchen, Uebergabe an
//      Mensch) und die Antwort geht per WhatsApp zurueck
//
// WICHTIG: Diese Function muss mit --no-verify-jwt deployt werden, Meta
// schickt keinen Supabase-JWT. Autorisierung: Verify-Token (GET) bzw.
// Signatur-Logging (POST, siehe _shared/whatsapp.ts).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { jsonResponse } from "../_shared/cors.ts";
import { sendWhatsAppText, logMetaSignatureCheck } from "../_shared/whatsapp.ts";
import { fetchCalcomSlots, createCalcomBooking } from "../_shared/calcom.ts";

// Modell per Env uebersteuerbar (Kostenhebel); Default = faehigstes Opus.
const AI_MODEL = Deno.env.get("REACHLY_AI_MODEL") ?? "claude-opus-4-8";
const MAX_TOOL_ROUNDS = 5;
const HISTORY_LIMIT = 20;

interface ClientContext {
  clientId: string;
  clientName: string;
  settings: {
    wa_phone_number_id: string;
    business_description: string | null;
    ai_tone: string | null;
    ai_enabled: boolean;
    timezone: string;
    calcom_event_type_id: string | null;
  };
  waAccessToken: string;
  calcomApiKey: string | null;
}

Deno.serve(async (req) => {
  // --- Meta-Webhook-Verifizierung (einmalig beim Einrichten) ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  await logMetaSignatureCheck(
    Deno.env.get("META_APP_SECRET"),
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Meta buendelt Events; wir verarbeiten alle Textnachrichten und
  // bestaetigen IMMER mit 200, sonst wiederholt Meta die Zustellung endlos.
  try {
    const entries = (payload.entry ?? []) as Array<Record<string, unknown>>;
    for (const entry of entries) {
      const changes = (entry.changes ?? []) as Array<Record<string, unknown>>;
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value || !Array.isArray(value.messages)) continue; // Statuse etc. ignorieren
        await handleMessages(admin, value);
      }
    }
  } catch (err) {
    console.error("whatsapp-webhook: Verarbeitung fehlgeschlagen", err);
  }

  return jsonResponse({ ok: true });
});

async function handleMessages(admin: SupabaseClient, value: Record<string, unknown>) {
  const metadata = value.metadata as { phone_number_id?: string } | undefined;
  const phoneNumberId = metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const ctx = await loadClientContext(admin, phoneNumberId);
  if (!ctx) {
    console.warn(`whatsapp-webhook: keine client_settings fuer phone_number_id=${phoneNumberId}`);
    return;
  }

  const contacts = (value.contacts ?? []) as Array<{ wa_id?: string; profile?: { name?: string } }>;

  for (const msg of value.messages as Array<Record<string, unknown>>) {
    const waMessageId = msg.id as string | undefined;
    const waId = msg.from as string | undefined;
    if (!waMessageId || !waId) continue;

    // Dedup: Meta stellt Webhooks bei fehlender/verspaeteter 200 erneut zu.
    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (existing) continue;

    const text =
      msg.type === "text"
        ? ((msg.text as { body?: string })?.body ?? "")
        : `[${msg.type}-Nachricht - Inhalt kann nicht gelesen werden]`;
    if (!text) continue;

    const profileName = contacts.find((c) => c.wa_id === waId)?.profile?.name ?? null;
    const conversationId = await upsertConversation(admin, ctx.clientId, waId, profileName);

    await admin.from("messages").insert({
      conversation_id: conversationId,
      direction: "inbound",
      sender: "customer",
      body: text,
      wa_message_id: waMessageId,
    });
    await admin
      .from("conversations")
      .update({ last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    // KI nur, wenn fuer den Mandanten aktiviert und die Konversation nicht
    // von einem Menschen uebernommen oder geschlossen wurde.
    const { data: conv } = await admin
      .from("conversations")
      .select("status")
      .eq("id", conversationId)
      .single();
    if (!ctx.settings.ai_enabled || conv?.status !== "ai_active") continue;

    try {
      await runAiTurn(admin, ctx, conversationId, waId, profileName);
    } catch (err) {
      console.error("whatsapp-webhook: KI-Antwort fehlgeschlagen", err);
      // Ehrlicher Fallback statt Funkstille: Uebergabe an Mensch.
      await admin.from("conversations").update({ status: "human_handoff" }).eq("id", conversationId);
      const sent = await sendWhatsAppText({
        phoneNumberId: ctx.settings.wa_phone_number_id,
        accessToken: ctx.waAccessToken,
        to: waId,
        body: "Danke für Ihre Nachricht! Wir melden uns schnellstmöglich persönlich bei Ihnen.",
      });
      if (sent.ok) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          sender: "system",
          body: "Danke für Ihre Nachricht! Wir melden uns schnellstmöglich persönlich bei Ihnen.",
          wa_message_id: sent.waMessageId,
        });
      }
    }
  }
}

async function loadClientContext(
  admin: SupabaseClient,
  phoneNumberId: string,
): Promise<ClientContext | null> {
  const { data: settings } = await admin
    .from("client_settings")
    .select(
      "client_id, wa_phone_number_id, business_description, ai_tone, ai_enabled, timezone, calcom_event_type_id",
    )
    .eq("wa_phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!settings) return null;

  const [{ data: client }, { data: secrets }] = await Promise.all([
    admin.from("clients").select("name").eq("id", settings.client_id).single(),
    admin
      .from("client_integration_secrets")
      .select("wa_access_token, calcom_api_key")
      .eq("client_id", settings.client_id)
      .maybeSingle(),
  ]);
  if (!secrets?.wa_access_token) return null;

  return {
    clientId: settings.client_id,
    clientName: client?.name ?? "der Betrieb",
    settings,
    waAccessToken: secrets.wa_access_token,
    calcomApiKey: secrets.calcom_api_key ?? null,
  };
}

async function upsertConversation(
  admin: SupabaseClient,
  clientId: string,
  waId: string,
  profileName: string | null,
): Promise<string> {
  const phone = `+${waId}`;

  const { data: existingCustomer } = await admin
    .from("end_customers")
    .select("id, name, wa_id")
    .eq("client_id", clientId)
    .eq("phone", phone)
    .maybeSingle();

  let endCustomerId = existingCustomer?.id as string | undefined;
  if (!endCustomerId) {
    const { data: created, error } = await admin
      .from("end_customers")
      .insert({ client_id: clientId, phone, wa_id: waId, name: profileName })
      .select("id")
      .single();
    if (error) throw error;
    endCustomerId = created.id;
  } else if (!existingCustomer?.wa_id || (!existingCustomer?.name && profileName)) {
    await admin
      .from("end_customers")
      .update({ wa_id: waId, name: existingCustomer?.name ?? profileName })
      .eq("id", endCustomerId);
  }

  // Juengste offene Konversation weiterfuehren, sonst neue beginnen.
  const { data: openConv } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("end_customer_id", endCustomerId)
    .eq("channel", "whatsapp")
    .neq("status", "closed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openConv) return openConv.id;

  const { data: newConv, error } = await admin
    .from("conversations")
    .insert({
      client_id: clientId,
      end_customer_id: endCustomerId,
      channel: "whatsapp",
      status: "ai_active",
    })
    .select("id")
    .single();
  if (error) throw error;
  return newConv.id;
}

// ---------------------------------------------------------------------------
// KI-Runde: Verlauf laden, Claude mit Tools laufen lassen, Antwort senden.
// ---------------------------------------------------------------------------

async function runAiTurn(
  admin: SupabaseClient,
  ctx: ClientContext,
  conversationId: string,
  waId: string,
  profileName: string | null,
) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY nicht gesetzt");
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const { data: history } = await admin
    .from("messages")
    .select("direction, sender, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const messages: Anthropic.MessageParam[] = (history ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));
  // API-Regel: erste Nachricht muss user sein
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return;

  const calendarReady = !!(ctx.calcomApiKey && ctx.settings.calcom_event_type_id);

  const system = [
    `Du bist der freundliche Kundenservice-Assistent von "${ctx.clientName}" und antwortest Kunden auf WhatsApp.`,
    ctx.settings.business_description
      ? `Über den Betrieb: ${ctx.settings.business_description}`
      : null,
    ctx.settings.ai_tone ? `Tonalität: ${ctx.settings.ai_tone}` : null,
    `Der Kunde heißt ${profileName ?? "unbekannt"}. Zeitzone des Betriebs: ${ctx.settings.timezone}. Aktuelles Datum: ${new Date().toLocaleDateString("de-DE", { timeZone: ctx.settings.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    "Regeln:",
    "- Antworte kurz und natürlich wie in einem Chat (1-3 Sätze), ohne Floskeln und ohne dich als KI zu erklären, außer der Kunde fragt danach.",
    "- Kläre das Anliegen des Kunden. Wenn ein Termin sinnvoll ist" +
      (calendarReady
        ? ", frage zuerst freie Zeiten über das Tool ab, biete 2-3 konkrete Slots an und buche erst nach ausdrücklicher Bestätigung des Kunden."
        : ", sage zu, dass sich der Betrieb zur Terminvereinbarung meldet, und nutze das Übergabe-Tool."),
    "- Mache keine Preiszusagen und keine fachlichen Ferndiagnosen. Erfinde nichts über den Betrieb.",
    "- Bei Beschwerden, Notfällen, Preisverhandlungen oder wenn du nicht weiterweißt: nutze das Übergabe-Tool und kündige dem Kunden an, dass sich jemand persönlich meldet.",
  ]
    .filter(Boolean)
    .join("\n");

  const tools: Anthropic.Tool[] = [
    {
      name: "handoff_to_human",
      description:
        "Übergibt die Konversation an einen Menschen im Betrieb. Nutzen bei Beschwerden, Notfällen, Preisfragen oder wenn das Anliegen nicht sicher geklärt werden kann.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string", description: "Kurzer Grund der Übergabe" } },
        required: ["reason"],
      },
    },
  ];
  if (calendarReady) {
    tools.push(
      {
        name: "get_available_slots",
        description:
          "Fragt freie Termin-Slots des Betriebs ab. Nutzen, bevor dem Kunden Termine angeboten werden.",
        input_schema: {
          type: "object",
          properties: {
            days_ahead: {
              type: "integer",
              description: "Wie viele Tage in die Zukunft gesucht wird (1-14)",
            },
          },
          required: ["days_ahead"],
        },
      },
      {
        name: "book_appointment",
        description:
          "Bucht einen Termin verbindlich. Nur nutzen, nachdem der Kunde einen konkreten Slot ausdrücklich bestätigt hat.",
        input_schema: {
          type: "object",
          properties: {
            start_iso: { type: "string", description: "Startzeit des bestätigten Slots (ISO 8601)" },
            title: { type: "string", description: "Kurzbeschreibung des Anliegens, z. B. 'Auspuff prüfen'" },
          },
          required: ["start_iso", "title"],
        },
      },
    );
  }

  let handedOff = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system,
      tools,
      messages,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (finalText) {
        const sent = await sendWhatsAppText({
          phoneNumberId: ctx.settings.wa_phone_number_id,
          accessToken: ctx.waAccessToken,
          to: waId,
          body: finalText,
        });
        await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          sender: "ai",
          body: finalText,
          wa_message_id: sent.waMessageId,
        });
      }
      return;
    }

    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      let result = "";
      let isError = false;
      try {
        result = await executeTool(admin, ctx, conversationId, waId, profileName, toolUse);
        if (toolUse.name === "handoff_to_human") handedOff = true;
      } catch (err) {
        isError = true;
        result = `Fehler: ${(err as Error).message}`;
      }
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
        is_error: isError,
      });
    }
    messages.push({ role: "user", content: results });

    // Nach einer Uebergabe soll die KI nur noch die Abschlussnachricht
    // formulieren - weitere Tool-Runden sind nicht sinnvoll.
    if (handedOff) {
      const closing = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 512,
        thinking: { type: "adaptive" },
        system,
        tools,
        tool_choice: { type: "none" },
        messages,
      });
      const text = closing.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) {
        const sent = await sendWhatsAppText({
          phoneNumberId: ctx.settings.wa_phone_number_id,
          accessToken: ctx.waAccessToken,
          to: waId,
          body: text,
        });
        await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          sender: "ai",
          body: text,
          wa_message_id: sent.waMessageId,
        });
      }
      return;
    }
  }

  console.warn("whatsapp-webhook: MAX_TOOL_ROUNDS erreicht ohne finale Antwort");
}

async function executeTool(
  admin: SupabaseClient,
  ctx: ClientContext,
  conversationId: string,
  waId: string,
  profileName: string | null,
  toolUse: Anthropic.ToolUseBlock,
): Promise<string> {
  const input = toolUse.input as Record<string, unknown>;

  if (toolUse.name === "handoff_to_human") {
    await admin
      .from("conversations")
      .update({ status: "human_handoff" })
      .eq("id", conversationId);
    return `Übergabe vermerkt (Grund: ${input.reason}). Der Betrieb sieht die Konversation im Posteingang.`;
  }

  if (toolUse.name === "get_available_slots") {
    const days = Math.min(Math.max(Number(input.days_ahead) || 7, 1), 14);
    const start = new Date();
    const end = new Date(Date.now() + days * 86_400_000);
    const slots = await fetchCalcomSlots({
      apiKey: ctx.calcomApiKey!,
      eventTypeId: ctx.settings.calcom_event_type_id!,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      timeZone: ctx.settings.timezone,
    });
    if (!slots.length) return "Keine freien Slots im Zeitraum gefunden.";
    const formatted = slots.slice(0, 8).map((iso) => {
      const label = new Date(iso).toLocaleString("de-DE", {
        timeZone: ctx.settings.timezone,
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${iso} => ${label} Uhr`;
    });
    return `Freie Slots (ISO => lesbar):\n${formatted.join("\n")}`;
  }

  if (toolUse.name === "book_appointment") {
    const startIso = String(input.start_iso ?? "");
    const title = String(input.title ?? "Termin");
    const booking = await createCalcomBooking({
      apiKey: ctx.calcomApiKey!,
      eventTypeId: ctx.settings.calcom_event_type_id!,
      startIso,
      name: profileName ?? `WhatsApp-Kunde +${waId}`,
      phone: `+${waId}`,
      // Cal.com verlangt eine E-Mail; WhatsApp-Kunden haben keine ->
      // eindeutige Platzhalteradresse, Bestaetigung laeuft ueber WhatsApp.
      email: `wa-${waId}@kunden.reachly.app`,
      timeZone: ctx.settings.timezone,
    });

    const { data: endCustomer } = await admin
      .from("end_customers")
      .select("id")
      .eq("client_id", ctx.clientId)
      .eq("phone", `+${waId}`)
      .single();

    await admin.from("appointments").insert({
      client_id: ctx.clientId,
      end_customer_id: endCustomer!.id,
      conversation_id: conversationId,
      title,
      starts_at: booking.start,
      ends_at: booking.end,
      status: "confirmed",
    });

    const label = new Date(booking.start).toLocaleString("de-DE", {
      timeZone: ctx.settings.timezone,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Termin gebucht: ${label} Uhr.`;
  }

  return `Unbekanntes Tool: ${toolUse.name}`;
}
