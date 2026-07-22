// Twilio-Hilfsfunktionen. Kein npm-Twilio-SDK verwendet (Deno-Edge-
// Kompatibilitaet unsicher) - stattdessen die dokumentierten REST-Aufrufe
// direkt per fetch(), und die Signaturpruefung per Web Crypto nachgebaut.

/**
 * Twilios dokumentierter Signatur-Algorithmus:
 * Base64(HMAC-SHA1(authToken, url + sortierte "key"+"value"-Paare aneinandergehaengt)).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): Promise<string> {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * WICHTIG: Aktuell bewusst NUR loggend, nicht blockierend. Supabases
 * Edge-Gateway koennte die vom Deno-Handler gesehene req.url gegenueber der
 * URL, die Twilio tatsaechlich signiert hat, umschreiben - das wuerde echte
 * Anrufe faelschlich ablehnen. Erst nach Abgleich mit echten Testanrufen auf
 * "ablehnen bei Mismatch" umstellen (siehe Aufrufer in den beiden
 * twilio-voice-*-Functions).
 */
export async function logTwilioSignatureCheck(
  authToken: string | undefined,
  url: string,
  params: Record<string, string>,
  receivedSignature: string | null,
): Promise<void> {
  if (!authToken) return;
  try {
    const expected = await computeTwilioSignature(authToken, url, params);
    console.log(
      `Twilio-Signaturpruefung (log-only): matches=${expected === receivedSignature} expected=${expected} received=${receivedSignature}`,
    );
  } catch (err) {
    console.error("Twilio-Signaturpruefung fehlgeschlagen", err);
  }
}

export function formDataToParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }
  return params;
}

export async function sendTwilioSms(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<boolean> {
  const basicAuth = `Basic ${btoa(`${params.accountSid}:${params.authToken}`)}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: basicAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: params.to, From: params.from, Body: params.body }),
  });
  if (!res.ok) {
    console.error("sendTwilioSms: Twilio Messages API Fehler", await res.text());
  }
  return res.ok;
}
