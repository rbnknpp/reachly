import * as React from "react";
import { toast } from "sonner";
import { Check, Phone, MessageCircle, CalendarClock, Palette, ArrowRight, ArrowLeft } from "lucide-react";
import { useClientSettings, useUpdateClientSettings } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientSettings } from "@schema/database";

interface Props {
  clientId: string;
  onDone: () => void;
}

interface StepDef {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  {
    key: "contact",
    title: "Kontakt",
    description: "Auf diese Nummer werden Rückrufe geleitet. Eine automatische Anruf-Erkennung könnt ihr danach jederzeit unter „Einstellungen“ dazu einrichten.",
    icon: Phone,
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Damit Kunden direkt per WhatsApp schreiben können. Die Nummer und die Phone-Number-ID kommen aus der WhatsApp-Business-API des Mandanten.",
    icon: MessageCircle,
  },
  {
    key: "booking",
    title: "Terminbuchung",
    description: "Verbindet Reachly mit dem Cal.com-Kalender, damit Kunden direkt freie Termine buchen können. Ohne diese Angaben bleibt „Termin buchen“ im Widget automatisch ausgeblendet.",
    icon: CalendarClock,
  },
  {
    key: "design",
    title: "Design",
    description: "So sieht der Kontakt-Button später auf der Kundenwebsite aus.",
    icon: Palette,
  },
];

export function OnboardingWizard({ clientId, onDone }: Props) {
  const { data: settings, isLoading } = useClientSettings(clientId);
  const updateSettings = useUpdateClientSettings(clientId);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [form, setForm] = React.useState<Partial<ClientSettings> | null>(null);

  React.useEffect(() => {
    if (settings) setForm((prev) => prev ?? settings);
  }, [settings]);

  if (isLoading || !form) return <div className="text-sm text-muted-foreground">Lädt …</div>;

  function set<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  async function saveCurrentStep() {
    const fieldsByStep: Record<string, (keyof ClientSettings)[]> = {
      contact: ["business_phone"],
      whatsapp: ["wa_business_number", "wa_phone_number_id"],
      booking: ["calcom_username", "calcom_event_type_id"],
      design: ["widget_accent_color", "widget_position", "widget_greeting"],
    };
    const fields = fieldsByStep[step.key] ?? [];
    const partial: Partial<ClientSettings> = {};
    for (const f of fields) (partial as Record<string, unknown>)[f] = form?.[f];
    try {
      await updateSettings.mutateAsync(partial);
      return true;
    } catch (err) {
      toast.error("Speichern fehlgeschlagen", { description: (err as Error).message });
      return false;
    }
  }

  async function handleNext() {
    const ok = await saveCurrentStep();
    if (!ok) return;
    if (isLastStep) {
      toast.success("Einrichtung gespeichert");
      onDone();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < stepIndex
                  ? "bg-primary text-primary-foreground"
                  : i === stepIndex
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground",
              )}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < stepIndex ? "bg-primary" : "bg-border")} />}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">
              Schritt {stepIndex + 1} von {STEPS.length}: {step.title}
            </CardTitle>
          </div>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step.key === "contact" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob_business_phone">Telefonnummer (E.164)</Label>
              <Input
                id="ob_business_phone"
                value={form.business_phone ?? ""}
                onChange={(e) => set("business_phone", e.target.value)}
                placeholder="+4915112345678"
              />
            </div>
          )}

          {step.key === "whatsapp" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_wa_business_number">WhatsApp-Business-Nummer</Label>
                <Input
                  id="ob_wa_business_number"
                  value={form.wa_business_number ?? ""}
                  onChange={(e) => set("wa_business_number", e.target.value)}
                  placeholder="+4915112345678"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_wa_phone_number_id">WhatsApp Phone-Number-ID</Label>
                <Input
                  id="ob_wa_phone_number_id"
                  value={form.wa_phone_number_id ?? ""}
                  onChange={(e) => set("wa_phone_number_id", e.target.value)}
                />
              </div>
            </>
          )}

          {step.key === "booking" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_calcom_username">Cal.com Benutzername</Label>
                <Input
                  id="ob_calcom_username"
                  value={form.calcom_username ?? ""}
                  onChange={(e) => set("calcom_username", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_calcom_event_type_id">Cal.com Event-Type-ID</Label>
                <Input
                  id="ob_calcom_event_type_id"
                  value={form.calcom_event_type_id ?? ""}
                  onChange={(e) => set("calcom_event_type_id", e.target.value)}
                />
              </div>
            </>
          )}

          {step.key === "design" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_widget_accent_color">Akzentfarbe</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="ob_widget_accent_color"
                    type="color"
                    className="h-9 w-12 rounded-md border border-border bg-background p-1"
                    value={form.widget_accent_color ?? "#059669"}
                    onChange={(e) => set("widget_accent_color", e.target.value)}
                  />
                  <Input value={form.widget_accent_color ?? "#059669"} onChange={(e) => set("widget_accent_color", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob_widget_greeting">Begrüßungstext</Label>
                <Input
                  id="ob_widget_greeting"
                  value={form.widget_greeting ?? ""}
                  onChange={(e) => set("widget_greeting", e.target.value)}
                  placeholder="Wie können wir helfen?"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button type="button" variant="outline" onClick={() => setStepIndex((i) => i - 1)}>
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onDone} className="text-muted-foreground">
            Einrichtung überspringen
          </Button>
        </div>
        <Button type="button" onClick={() => void handleNext()} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Speichert …" : isLastStep ? "Fertig" : "Weiter"}
          {!isLastStep && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
