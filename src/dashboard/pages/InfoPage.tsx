import { PhoneMissed, MessageSquareText, Sparkles, CalendarCheck2, Star, Building2, MessagesSquare, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const flowSteps = [
  {
    icon: PhoneMissed,
    title: "Anruf verpasst",
    description: "Ein Kunde ruft an, niemand kann rangehen – Werkstatt, Baustelle, nächster Termin.",
  },
  {
    icon: MessageSquareText,
    title: "Sofort-SMS",
    description: "Reachly erkennt den verpassten Anruf und schickt automatisch eine SMS mit WhatsApp-Link.",
  },
  {
    icon: Sparkles,
    title: "KI qualifiziert",
    description: "Auf WhatsApp klärt die KI freundlich das Anliegen – rund um die Uhr, ohne Wartezeit.",
  },
  {
    icon: CalendarCheck2,
    title: "Termin gebucht",
    description: "Ein passender freier Slot wird direkt im Kalender reserviert, ganz ohne Telefonat.",
  },
  {
    icon: Star,
    title: "Bewertung angefragt",
    description: "Geplant: 48 Stunden nach dem Termin automatisch nach einer Google-Bewertung fragen. Dieser letzte Schritt ist im Datenmodell vorbereitet, aber im Versand noch nicht aktiv.",
  },
];

const roleExplanations = {
  agency: {
    icon: Building2,
    title: "Deine Rolle: Agentur",
    description:
      "Du legst Mandanten an, richtest deren Telefonnummer, WhatsApp und Kalender ein und behältst über alle Mandanten hinweg den Überblick (Posteingang, Termine, Statistik). Unter „Mandanten“ findest du für jeden Betrieb den fertigen Embed-Code fürs Widget.",
  },
  client: {
    icon: MessagesSquare,
    title: "Deine Rolle: Mandant",
    description:
      "Du siehst nur deinen eigenen Posteingang, Termine und Statistiken. Unter „Einstellungen“ kannst du deine Kontaktdaten, den Begrüßungstext und die Farbe deines Widgets anpassen.",
  },
};

export function InfoPage() {
  const { profile } = useAuth();
  const role = profile?.role === "agency" ? roleExplanations.agency : roleExplanations.client;
  const RoleIcon = role.icon;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Über Reachly</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reachly ist ein KI-Erreichbarkeits-Assistent für Selbstständige: Handwerker, KFZ-Betriebe und
          Dienstleister verpassen keinen Auftrag mehr, nur weil das Telefon gerade nicht erreichbar war.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RoleIcon className="h-4 w-4 text-primary" />
            {role.title}
          </CardTitle>
          <CardDescription>{role.description}</CardDescription>
        </CardHeader>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold">So funktioniert der Ablauf</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {flowSteps.map((step, i) => (
            <Card key={step.title} className="relative">
              <CardContent className="flex flex-col gap-2 pt-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                </div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Drei Wege, wie Kunden Kontakt aufnehmen</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-semibold">WhatsApp-Chat</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ein Klick öffnet WhatsApp mit vorausgefülltem Text – der Kunde schreibt die erste Nachricht selbst.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-semibold">Rückruf anfordern</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Name, Nummer und Anliegen landen direkt im Posteingang – ohne dass der Kunde selbst anrufen muss.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-semibold">Termin buchen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Echte freie Slots aus dem Kalender, direkt buchbar – erscheint nur, wenn Cal.com verbunden ist.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <Palette className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            Das Widget passt sich optisch an: Akzentfarbe, Position und Begrüßungstext lassen sich pro Mandant unter
            „Einstellungen“ einstellen. Nur was auch wirklich eingerichtet ist (z. B. eine hinterlegte
            WhatsApp-Nummer oder Cal.com-Verbindung), erscheint später als Option im Widget.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
