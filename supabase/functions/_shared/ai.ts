// Duenner Client fuer die Anthropic Messages API - kein SDK, nur fetch(),
// gleiches Prinzip wie twilio.ts und calcom.ts in diesem Ordner.
import { sendTwilioSms } from "./twilio.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

interface HistoryEntry {
  role: "customer" | "ai";
  body: string;
}

export async function generateAiReply(params: {
  apiKey: string;
  businessName: string;
  businessDescription: string | null;
  aiTone: string | null;
  history: HistoryEntry[];
}): Promise<string> {
  const systemPrompt = [
    `Du bist der KI-Assistent von "${params.businessName}", einem Handwerks-/Dienstleistungsbetrieb.`,
    params.businessDescription ? `Über den Betrieb: ${params.businessDescription}` : null,
    params.aiTone ? `Gewünschter Ton: ${params.aiTone}` : "Ton: freundlich, direkt, professionell.",
    "Antworte kurz (max. 2-3 Sätze, SMS-tauglich), auf Deutsch. Kläre das Anliegen des Kunden und frage " +
      "gezielt nach, was noch fehlt, um einen Termin oder Rückruf vorzubereiten. Keine Grußfloskeln wie " +
      '"Sehr geehrte/r", schreib wie ein echter Mensch per SMS.',
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: params.history.map((m) => ({
        role: m.role === "customer" ? "user" : "assistant",
        content: m.body,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API Fehler (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error("Anthropic API: keine Antwort erhalten");
  return text.trim();
}

/**
 * Laedt Kontext + Verlauf einer Konversation, holt eine KI-Antwort, speichert
 * sie als Nachricht und verschickt sie (aktuell nur Kanal "sms", da WhatsApp
 * ohne eigenen Business-API-Webhook nicht an Reachly zurueckfliesst).
 * Bricht still ab (nur Log), wenn KI deaktiviert ist oder etwas fehlschlaegt -
 * ein liegen gebliebener Kundenkontakt soll nie einen 500er im aufrufenden
 * Endpoint (z. B. widget-lead) verursachen.
 */
export async function generateAndSendAiReply(supabase: any, conversationId: string): Promise<void> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, client_id, channel, status, end_customer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.status !== "ai_active") return;

  const { data: settings } = await supabase
    .from("client_settings")
    .select("business_description, ai_tone, ai_enabled, sms_sender_number")
    .eq("client_id", conversation.client_id)
    .maybeSingle();
  if (!settings?.ai_enabled) return;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("generateAndSendAiReply: ANTHROPIC_API_KEY fehlt");
    return;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", conversation.client_id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select("sender, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const history: HistoryEntry[] = (messages ?? [])
    .filter((m: { sender: string }) => m.sender === "customer" || m.sender === "ai")
    .map((m: { sender: string; body: string }) => ({
      role: m.sender === "customer" ? "customer" : "ai",
      body: m.body,
    }));
  if (history.length === 0) return;

  let reply: string;
  try {
    reply = await generateAiReply({
      apiKey,
      businessName: client?.name ?? "unser Betrieb",
      businessDescription: settings.business_description,
      aiTone: settings.ai_tone,
      history,
    });
  } catch (err) {
    console.error("generateAndSendAiReply: Anthropic-Aufruf fehlgeschlagen", err);
    return;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    sender: "ai",
    body: reply,
  });

  if (conversation.channel === "sms" && settings.sms_sender_number) {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const { data: endCustomer } = await supabase
      .from("end_customers")
      .select("phone")
      .eq("id", conversation.end_customer_id)
      .maybeSingle();
    if (endCustomer?.phone && accountSid && authToken) {
      await sendTwilioSms({
        accountSid,
        authToken,
        from: settings.sms_sender_number,
        to: endCustomer.phone,
        body: reply,
      });
    }
  }
}
