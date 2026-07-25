// WhatsApp-Cloud-API-Helfer (Meta Graph API). Kein SDK - direkte fetch()-
// Aufrufe wie bei Twilio in _shared/twilio.ts. Der Access-Token kommt pro
// Mandant aus client_integration_secrets.wa_access_token, die Absender-
// Nummer aus client_settings.wa_phone_number_id.

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

/** Freitext senden. Nur innerhalb des 24h-Kundenservice-Fensters erlaubt. */
export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string; // wa_id des Empfaengers
  body: string;
}): Promise<{ ok: boolean; waMessageId: string | null }> {
  const res = await fetch(`${GRAPH_API_BASE}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.body },
    }),
  });

  if (!res.ok) {
    console.error("sendWhatsAppText: WhatsApp API Fehler", await res.text());
    return { ok: false, waMessageId: null };
  }

  const json = await res.json();
  return { ok: true, waMessageId: json?.messages?.[0]?.id ?? null };
}

/**
 * Webhook-Signatur von Meta pruefen (X-Hub-Signature-256,
 * HMAC-SHA256 ueber den rohen Body mit dem App-Secret).
 * WICHTIG: Wie bei Twilio (_shared/twilio.ts) aktuell bewusst NUR loggend -
 * erst nach Abgleich mit echten Webhook-Zustellungen auf "ablehnen bei
 * Mismatch" umstellen.
 */
export async function logMetaSignatureCheck(
  appSecret: string | undefined,
  rawBody: string,
  receivedSignature: string | null,
): Promise<void> {
  if (!appSecret) return;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected =
      "sha256=" +
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    console.log(
      `Meta-Signaturpruefung (log-only): matches=${expected === receivedSignature} expected=${expected} received=${receivedSignature}`,
    );
  } catch (err) {
    console.error("Meta-Signaturpruefung fehlgeschlagen", err);
  }
}
