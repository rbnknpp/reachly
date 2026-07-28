// POST /functions/v1/ai-chat — leichter KI-Chat mit vorab kuratiertem Wissen
// ueber Reachly. Zwei Oberflaechen teilen sich diese eine Function:
//   surface="marketing" — reachly-marketing, oeffentlich, Produktfragen von
//     Interessenten (kein Login, daher IP-basiertes Rate-Limit statt Auth)
//   surface="dashboard"  — reachly-hosting-shell, eingeloggte Nutzer, Fragen
//     zur Bedienung des Dashboards (role="agency"|"client" steuert den Inhalt)
// Muss mit --no-verify-jwt deployt werden (Marketing-Seite hat keinen JWT).
// Kein Tool-Use noetig - reine Wissensfragen, kurze Antworten.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const AI_MODEL = Deno.env.get("REACHLY_AI_MODEL") ?? "claude-opus-4-8";
const HISTORY_LIMIT = 12;
const MAX_MESSAGE_LENGTH = 2000;

const FALLBACK_REPLY =
  "Der KI-Chat ist gerade noch nicht aktiv. Bitte nutzen Sie in der Zwischenzeit das Kontaktformular bzw. wenden Sie sich direkt an Ihren Ansprechpartner.";

const MARKETING_SYSTEM = `Du bist der Chat-Assistent auf der Website von Reachly und beantwortest Fragen von Interessenten (Handwerksbetriebe, Dienstleister, Vertriebsteams).

Was Reachly ist: ein KI-Erreichbarkeits-Assistent für Betriebe, die während der Arbeit Anrufe verpassen. Zielgruppen laut Website u. a. Reifendienste, KFZ-Werkstätten, Dachdecker, Heizungsbauer, Elektriker, Sanitär, Gartenbau, Maler, Versicherungsvertretungen, Vertriebsteams, Immobilienmakler.

So funktioniert es:
- Verpasster Anruf → der Anrufer bekommt innerhalb weniger Sekunden automatisch eine SMS mit freundlicher Nachricht und WhatsApp-Link.
- Auf WhatsApp beantwortet eine KI (mit Namen, Ton und Leistungsspektrum des jeweiligen Betriebs) die Anfrage, schlägt freie Termine aus dem Kalender vor und bucht sie direkt nach Bestätigung. Der Betrieb kann jede Konversation live mitlesen und jederzeit selbst übernehmen; die KI übergibt auch von sich aus, wenn ein Anliegen nicht ins Raster passt.
- Weitere anbindbare Kanäle: E-Mail, Instagram, Website-Chat-Widget, SMS. Bei diesen landet jede Nachricht sofort im gemeinsamen Posteingang, geantwortet wird dort vom Betrieb selbst (keine KI-Automatik).
- Nach dem Termin: automatische Bewertungsanfrage per SMS (Standard 48h danach), 48h vor dem Termin: automatische Erinnerungs-E-Mail.
- Einbau: eine einzige Script-Zeile für das Website-Widget, kein Website-Umbau nötig, funktioniert mit jeder Website (WordPress, Lovable, Baukasten, handgebaut). Auf Wunsch übernimmt Reachly den kompletten Einbau inkl. WhatsApp-Business-Nummer, SMS-Absendernummer, Kalenderanbindung, KI-Wissen über den Betrieb.
- Alles läuft in einem gemeinsamen Dashboard zusammen: jede Konversation, jeder gebuchte Termin, jede zurückgeholte Anfrage.

Preise & Laufzeit: es gibt keine öffentliche Preisliste. Der Preis hängt vom Umfang ab (welche Kanäle, ob Reachly die Einrichtung komplett übernimmt). In einer kostenlosen Demo wird durchgerechnet, was Reachly für den jeweiligen Betrieb kostet und was verpasste Anrufe aktuell kosten. Laufzeiten sind fair und transparent, Details klärt das Demo-Gespräch.

Kontakt/nächster Schritt: für eine Demo oder konkrete Preisfragen auf das Kontaktformular bzw. die E-Mail hallo@reachly.app verweisen.

Regeln:
- Antworte kurz (2-4 Sätze), freundlich, auf Deutsch, ohne Marketing-Floskeln.
- Sprich die Person IMMER mit "Sie" an (Höflichkeitsform), nie mit "du" - das entspricht der Tonalität der gesamten Website.
- Erfinde keine Preise, Zahlen oder Funktionen, die hier nicht genannt sind. Bei allem, was du nicht sicher weißt (z. B. exakte Kosten, individuelle Sonderfälle): ehrlich sagen, dass das im Demo-Gespräch geklärt wird, und auf hallo@reachly.app verweisen.
- Kein Fachjargon, die Zielgruppe sind Handwerksbetriebe ohne IT-Hintergrund.`;

const DASHBOARD_SYSTEM_BASE = `Du bist der Chat-Assistent im Reachly-Dashboard und hilfst eingeloggten Nutzern bei der Bedienung (nicht beim Verkauf - die Person nutzt Reachly bereits).

Aufbau des Dashboards (Seiten in der Seitenleiste):
- Posteingang: alle Konversationen über alle Kanäle (WhatsApp, SMS, E-Mail, Instagram, Website-Chat) in einer Liste. Jede Konversation hat einen Status: "ai_active" (KI antwortet automatisch, nur bei WhatsApp), "human_handoff" (an einen Menschen übergeben, KI fasst sie nicht mehr an), "closed". Der Status lässt sich manuell umschalten ("Übernehmen"), um die KI zu stoppen und selbst zu antworten.
- Termine: Liste aller gebuchten Termine (aus WhatsApp-Buchungen oder über das Website-Widget).
- Statistik: Kennzahlen zu Anfragen, Terminen, Kanälen im Zeitverlauf.
- Verbindungen (nur Kunden-Login): Status der angebundenen Kanäle (WhatsApp, Kalender/Cal.com usw.).
- Einstellungen (nur Kunden-Login): u. a. Geschäftsbeschreibung für die KI, Ton der KI, Google-Bewertungslink, Widget-Aussehen und -Texte, Social-Media-Links fürs Widget.

Automationen, die im Hintergrund laufen: Terminerinnerung per E-Mail 48h vor dem Termin, Bewertungsanfrage per SMS 48h nach dem Termin (falls Google-Bewertungslink hinterlegt ist).

Regeln:
- Antworte kurz (2-4 Sätze), konkret, auf Deutsch, sag wo im Dashboard etwas zu finden ist (Seitenname).
- Sprich die Person IMMER mit "Sie" an (Höflichkeitsform), nie mit "du" - das entspricht der Tonalität des gesamten Dashboards.
- Wenn eine Frage nach echten Kundendaten klingt (z. B. "welche Konversation hat Kunde X"), sag, dass du dafür keinen Datenzugriff hast, und verweise auf den Posteingang.
- Erfinde keine Funktionen, die hier nicht beschrieben sind.`;

const DASHBOARD_SYSTEM_AGENCY = `

Die Person ist bei der Agentur (verwaltet mehrere Mandanten/Kunden). Zusätzliche Seite: "Mandanten" - Übersicht aller Kunden-Betriebe mit KPIs (aktive Logins, Kanal-Status, Verlängerung fällig). Von dort aus kann die Agentur einen neuen Mandanten anlegen (inkl. optionaler Login-Einladung per E-Mail an den Kunden) und die Einstellungen jedes Mandanten bearbeiten.`;

const DASHBOARD_SYSTEM_CLIENT = `

Die Person ist ein Kunden-Login (Betrieb selbst, kein Agentur-Mitarbeiter). Sieht nur die Daten des eigenen Betriebs.`;

interface ChatBody {
  surface?: string;
  message?: string;
  history?: { role?: string; content?: string }[];
  role?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const surface = body.surface === "dashboard" ? "dashboard" : "marketing";
  const message = body.message?.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) return jsonResponse({ error: "message ist erforderlich" }, 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: allowed } = await admin.rpc("check_rate_limit", {
    p_client_key: ip,
    p_action: `ai-chat-${surface}`,
    p_max_requests: 20,
    p_window_seconds: 300,
  });
  if (!allowed) return jsonResponse({ error: "Zu viele Anfragen, bitte kurz warten." }, 429);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return jsonResponse({ reply: FALLBACK_REPLY });

  const system =
    surface === "marketing"
      ? MARKETING_SYSTEM
      : DASHBOARD_SYSTEM_BASE + (body.role === "agency" ? DASHBOARD_SYSTEM_AGENCY : DASHBOARD_SYSTEM_CLIENT);

  const history = Array.isArray(body.history) ? body.history.slice(-HISTORY_LIMIT) : [];
  const messages: Anthropic.MessageParam[] = [
    ...history
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && !!m.content,
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) })),
    { role: "user" as const, content: message },
  ];
  while (messages.length && messages[0].role !== "user") messages.shift();

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system,
      messages,
    });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return jsonResponse({ reply: reply || "Dazu kann ich gerade leider nichts Genaues sagen." });
  } catch (err) {
    console.error("ai-chat: Anthropic-Fehler", err);
    return jsonResponse({ error: "KI-Antwort fehlgeschlagen, bitte später erneut versuchen." }, 502);
  }
});
