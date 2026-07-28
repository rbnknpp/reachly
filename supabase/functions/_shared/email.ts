// Resend-Hilfsfunktion. Kein SDK verwendet (gleiches Prinzip wie
// _shared/twilio.ts) - Resend hat eine simple REST-API, dafuer reicht
// ein einzelner fetch()-Aufruf.

export async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) {
    console.error("sendResendEmail: Resend API Fehler", await res.text());
  }
  return res.ok;
}
