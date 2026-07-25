import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface FaqItem {
  question: string;
  answer: string;
}

const generalFaq: FaqItem[] = [
  {
    question: "Wie baue ich Reachly auf meiner Website ein?",
    answer:
      'Eine einzige Zeile Code. Unter „Einstellungen" findest du einen fertigen Embed-Code-Schnipsel (<script src="…" data-key="…">) – einmal in die eigene Website einfügen, fertig. Das funktioniert unabhängig davon, womit die Website gebaut wurde (Lovable, WordPress, handgebaut).',
  },
  {
    question: "Warum sehe ich „Rückruf anfordern“ oder „Termin buchen“ nicht im Widget-Vorschaubild?",
    answer:
      "Diese Buttons erscheinen nur, wenn die dazugehörigen Daten wirklich hinterlegt sind: „Rückruf“ braucht eine erreichbare Telefonnummer, „Termin buchen“ braucht eine vollständige Cal.com-Verbindung. So verspricht das Widget nie mehr, als es tatsächlich einlösen kann.",
  },
  {
    question: "Wie ändere ich Farbe, Position oder Begrüßungstext des Widgets?",
    answer:
      'Unter „Einstellungen" im Abschnitt „Widget": Akzentfarbe per Farbwähler, Button-Position links/rechts und der Begrüßungstext lassen sich frei einstellen und wirken sofort auf der Kundenwebsite.',
  },
  {
    question: "Wie schnell reagiert Reachly auf einen verpassten Anruf?",
    answer:
      "Innerhalb weniger Sekunden wird automatisch eine SMS mit WhatsApp-Link an den Anrufer verschickt – ganz ohne manuelles Zutun.",
  },
  {
    question: "Was kostet die automatische Anruf-Erkennung?",
    answer:
      "Für die automatische Erkennung verpasster Anrufe wird eine eigene Telefonnummer bei Twilio eingerichtet (ca. 1–2 €/Monat). Anrufe an diese Nummer werden an die hinterlegte Geschäftsnummer weitergeleitet.",
  },
  {
    question: "Wann wird die Google-Bewertungsanfrage verschickt?",
    answer:
      "Die Verzögerung lässt sich in den Mandanten-Einstellungen bereits einstellen (Standard 48 Stunden, 1–336 möglich) und ein Google-Bewertungslink hinterlegen. Der automatische Versand selbst ist aber noch in Entwicklung und aktuell nicht aktiv.",
  },
];

const agencyFaq: FaqItem[] = [
  {
    question: "Wie gebe ich einem Mandanten einen eigenen Dashboard-Login?",
    answer:
      'In der Mandantenliste über den Button „Login einladen" – der Mandant bekommt eine E-Mail und setzt sein Passwort selbst. Er sieht danach ausschließlich seine eigenen Daten.',
  },
  {
    question: "Ein Mandant hat noch keine Antwort auf die Einladung gegeben – was tun?",
    answer:
      "Die Einladung kann jederzeit erneut verschickt werden. Solange kein Login gesetzt ist, kannst du als Agentur weiterhin alle Einstellungen für den Mandanten selbst pflegen.",
  },
];

function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Card key={item.question} className="overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
                {item.question}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-4 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FaqPage() {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Hilfe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Antworten auf häufige Fragen. Fehlt etwas, meld dich gern direkt bei uns.
        </p>
      </div>

      <FaqSection title="Allgemein" items={generalFaq} />
      {profile?.role === "agency" && <FaqSection title="Für Agenturen" items={agencyFaq} />}
    </div>
  );
}
