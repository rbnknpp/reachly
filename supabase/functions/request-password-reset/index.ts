// POST /functions/v1/request-password-reset
// Body: { email }
// Oeffentlich erreichbar (Nutzer ist per Definition ausgeloggt) - deshalb
// IP-Rate-Limit statt Auth, und bewusst IMMER dieselbe Erfolgsmeldung,
// unabhaengig davon, ob die Adresse tatsaechlich einen Account hat
// (verhindert User-Enumeration: ein Angreifer koennte sonst durchprobieren,
// welche E-Mail-Adressen registriert sind).
//
// Erzeugt den Supabase-Recovery-Link selbst (generateLink, verschickt keine
// E-Mail) und sendet ihn per Resend mit Reachly-Branding - gleiches Prinzip
// wie bei invite-client-user, aus demselben Grund: Supabases eigene
// Recovery-Mail ist generisch und landet bei echten Nutzern oft im Spam.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendResendEmail } from "../_shared/email.ts";

const GENERIC_OK = { ok: true, message: "Falls ein Konto mit dieser E-Mail existiert, wurde eine Nachricht verschickt." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return jsonResponse({ error: "email ist erforderlich" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { data: allowed } = await admin.rpc("check_rate_limit", {
    p_client_key: ip,
    p_action: "request-password-reset",
    p_max_requests: 5,
    p_window_seconds: 900,
  });
  if (!allowed) return jsonResponse({ error: "Zu viele Anfragen, bitte später erneut versuchen." }, 429);

  const dashboardUrl = Deno.env.get("DASHBOARD_URL") ?? "http://localhost:5176";

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${dashboardUrl}/accept-invite` },
  });

  // Bewusst KEIN frueher Return bei error (z. B. "Nutzer nicht gefunden") -
  // die Antwort an den Client bleibt immer identisch, siehe GENERIC_OK oben.
  if (error) {
    console.warn("request-password-reset: generateLink ohne Treffer", email, error.message);
    return jsonResponse(GENERIC_OK);
  }

  const actionLink = data.properties?.action_link;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("INVITE_FROM_EMAIL") ?? "Reachly <einladung@verora.app>";

  if (actionLink && resendApiKey) {
    const html = `
      <div style="background:#e5e0d3;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#f3ede0;border-radius:12px;overflow:hidden;border-collapse:collapse;">
          <tr>
            <td style="background:#0f3d2e;padding:22px 28px;">
              <table role="presentation" style="border-collapse:collapse;">
                <tr>
                  <td style="width:32px;height:32px;background:#1f9d6e;border-radius:7px;text-align:center;vertical-align:middle;font-weight:bold;font-size:16px;color:#f3ede0;">R</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:bold;color:#f3ede0;">Reachly</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1c1912;">Hallo,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1c1912;">
                für Ihren Reachly-Zugang wurde ein neues Passwort angefordert. Klicken Sie auf den Button, um ein
                neues Passwort festzulegen.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px;text-align:center;">
              <table role="presentation" style="margin:0 auto;border-collapse:collapse;">
                <tr>
                  <td style="background:#0f3d2e;border-radius:8px;">
                    <a href="${actionLink}" style="display:inline-block;padding:13px 26px;font-size:14.5px;font-weight:bold;color:#f3ede0;text-decoration:none;">Neues Passwort festlegen</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8578;">
                Der Link ist aus Sicherheitsgründen zeitlich begrenzt gültig. Falls Sie diese Anfrage nicht
                gestellt haben, können Sie diese E-Mail einfach ignorieren - Ihr Passwort bleibt unverändert.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `.trim();

    const sent = await sendResendEmail({
      apiKey: resendApiKey,
      from: fromAddress,
      to: email,
      subject: "Neues Passwort für Ihren Reachly-Zugang",
      html,
    });
    if (!sent) console.error("request-password-reset: Resend-Versand fehlgeschlagen");
  } else if (!resendApiKey) {
    console.warn("request-password-reset: RESEND_API_KEY nicht gesetzt - Link wurde nur erzeugt, nicht verschickt");
  }

  return jsonResponse(GENERIC_OK);
});
