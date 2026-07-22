import * as React from "react";
import { toast } from "sonner";
import { useClientSettings, useUpdateClientSettings, useProvisionTwilioNumber } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClientSettings } from "@schema/database";

const E164 = /^\+[1-9]\d{6,14}$/;

interface Props {
  clientId: string;
  /** agency sees/edits everything incl. technische Zugangsdaten-Felder;
   * client sieht nur die eigenen, kundenrelevanten Einstellungen. */
  variant: "agency" | "client";
}

export function ClientSettingsForm({ clientId, variant }: Props) {
  const { data: settings, isLoading } = useClientSettings(clientId);
  const updateSettings = useUpdateClientSettings(clientId);
  const provisionTwilio = useProvisionTwilioNumber(clientId);
  const [form, setForm] = React.useState<Partial<ClientSettings> | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [showTwilioConfirm, setShowTwilioConfirm] = React.useState(false);

  React.useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (isLoading || !form) return <div className="text-sm text-muted-foreground">Lädt …</div>;

  function set<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form?.business_phone && !E164.test(form.business_phone)) {
      setPhoneError("Bitte im E.164-Format angeben, z. B. +4915112345678");
      return;
    }
    if (variant === "agency") {
      const delay = form?.review_delay_hours ?? 48;
      if (delay < 1 || delay > 336) {
        toast.error("review_delay_hours muss zwischen 1 und 336 liegen");
        return;
      }
    }
    setPhoneError(null);
    // Vor dem Speichern merken, ob noch keine Twilio-Nummer eingerichtet war -
    // danach (nach dem Refetch) waere sms_sender_number ja unveraendert leer,
    // das laesst sich nicht mehr unterscheiden.
    const hadNoNumberYet = !settings?.sms_sender_number;
    try {
      await updateSettings.mutateAsync(form ?? {});
      toast.success("Einstellungen gespeichert");
      if (hadNoNumberYet && form?.business_phone) {
        setShowTwilioConfirm(true);
      }
    } catch (err) {
      toast.error("Speichern fehlgeschlagen", { description: (err as Error).message });
    }
  }

  async function handleConfirmTwilio() {
    try {
      const result = await provisionTwilio.mutateAsync();
      toast.success(`Rufnummer eingerichtet: ${result.phone_number}`);
    } catch (err) {
      toast.error("Rufnummer konnte nicht eingerichtet werden", { description: (err as Error).message });
    } finally {
      setShowTwilioConfirm(false);
    }
  }

  const isAgency = variant === "agency";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Einstellungen</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSave}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="business_phone">Ihre Telefonnummer (E.164)</Label>
            <Input
              id="business_phone"
              value={form.business_phone ?? ""}
              onChange={(e) => set("business_phone", e.target.value)}
              placeholder="+4915112345678"
            />
            {phoneError && <span className="text-xs text-destructive">{phoneError}</span>}
          </div>

          {isAgency && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sms_sender_number">SMS-Absendernummer</Label>
              <Input
                id="sms_sender_number"
                value={form.sms_sender_number ?? ""}
                onChange={(e) => set("sms_sender_number", e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wa_business_number">WhatsApp-Business-Nummer</Label>
            <Input id="wa_business_number" value={form.wa_business_number ?? ""} onChange={(e) => set("wa_business_number", e.target.value)} />
          </div>

          {isAgency && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa_phone_number_id">WhatsApp Phone-Number-ID</Label>
                <Input id="wa_phone_number_id" value={form.wa_phone_number_id ?? ""} onChange={(e) => set("wa_phone_number_id", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calcom_username">Cal.com Benutzername</Label>
                <Input id="calcom_username" value={form.calcom_username ?? ""} onChange={(e) => set("calcom_username", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calcom_event_type_id">Cal.com Event-Type-ID</Label>
                <Input id="calcom_event_type_id" value={form.calcom_event_type_id ?? ""} onChange={(e) => set("calcom_event_type_id", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="timezone">Zeitzone</Label>
                <Input id="timezone" value={form.timezone ?? "Europe/Berlin"} onChange={(e) => set("timezone", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review_delay_hours">Review-Verzögerung (Stunden, 1–336)</Label>
                <Input
                  id="review_delay_hours"
                  type="number"
                  min={1}
                  max={336}
                  value={form.review_delay_hours ?? 48}
                  onChange={(e) => set("review_delay_hours", Number(e.target.value))}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="google_review_url">Google-Bewertungslink</Label>
            <Input id="google_review_url" value={form.google_review_url ?? ""} onChange={(e) => set("google_review_url", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="business_description">Unternehmensbeschreibung (für KI-Kontext)</Label>
            <Textarea id="business_description" rows={3} value={form.business_description ?? ""} onChange={(e) => set("business_description", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="missed_call_sms_text">SMS-Text bei verpasstem Anruf</Label>
            <Textarea id="missed_call_sms_text" rows={2} value={form.missed_call_sms_text ?? ""} onChange={(e) => set("missed_call_sms_text", e.target.value)} />
          </div>

          <div className="md:col-span-2 mt-2 border-t border-border pt-4 text-sm font-semibold">Widget</div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="widget_accent_color">Akzentfarbe</Label>
            <div className="flex items-center gap-2">
              <input
                id="widget_accent_color"
                type="color"
                className="h-9 w-12 rounded-md border border-border bg-background p-1"
                value={form.widget_accent_color ?? "#059669"}
                onChange={(e) => set("widget_accent_color", e.target.value)}
              />
              <Input value={form.widget_accent_color ?? "#059669"} onChange={(e) => set("widget_accent_color", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="widget_position">Button-Position</Label>
            <select
              id="widget_position"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={form.widget_position ?? "right"}
              onChange={(e) => set("widget_position", e.target.value as ClientSettings["widget_position"])}
            >
              <option value="right">Rechts</option>
              <option value="left">Links</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="widget_greeting">Begrüßungstext</Label>
            <Input id="widget_greeting" value={form.widget_greeting ?? ""} onChange={(e) => set("widget_greeting", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="widget_whatsapp_prefill_text">WhatsApp-Prefill-Text</Label>
            <Input
              id="widget_whatsapp_prefill_text"
              value={form.widget_whatsapp_prefill_text ?? ""}
              onChange={(e) => set("widget_whatsapp_prefill_text", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label>Aktive Aktionen im Widget</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_whatsapp ?? true}
                  onChange={(e) => set("widget_action_whatsapp", e.target.checked)}
                />
                WhatsApp-Chat
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_callback ?? true}
                  onChange={(e) => set("widget_action_callback", e.target.checked)}
                />
                Rückruf (per SMS)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_booking ?? true}
                  onChange={(e) => set("widget_action_booking", e.target.checked)}
                />
                Terminbuchung
              </label>
            </div>
          </div>

          <div className="md:col-span-2 mt-2 border-t border-border pt-4 text-sm font-semibold">Social Media</div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="widget_social_instagram_url">Instagram-Profil-URL</Label>
            <div className="flex items-center gap-3">
              <Input
                id="widget_social_instagram_url"
                className="flex-1"
                placeholder="https://instagram.com/ihrbetrieb"
                value={form.widget_social_instagram_url ?? ""}
                onChange={(e) => set("widget_social_instagram_url", e.target.value)}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_instagram ?? true}
                  onChange={(e) => set("widget_action_instagram", e.target.checked)}
                />
                Sichtbar
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="widget_social_facebook_url">Facebook-Messenger-Link (m.me/…)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="widget_social_facebook_url"
                className="flex-1"
                placeholder="https://m.me/ihrbetrieb"
                value={form.widget_social_facebook_url ?? ""}
                onChange={(e) => set("widget_social_facebook_url", e.target.value)}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_facebook ?? true}
                  onChange={(e) => set("widget_action_facebook", e.target.checked)}
                />
                Sichtbar
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="widget_social_tiktok_url">TikTok-Profil-URL</Label>
            <div className="flex items-center gap-3">
              <Input
                id="widget_social_tiktok_url"
                className="flex-1"
                placeholder="https://tiktok.com/@ihrbetrieb"
                value={form.widget_social_tiktok_url ?? ""}
                onChange={(e) => set("widget_social_tiktok_url", e.target.value)}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_action_tiktok ?? true}
                  onChange={(e) => set("widget_action_tiktok", e.target.checked)}
                />
                Sichtbar
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Speichert …" : "Speichern"}
            </Button>
          </div>
        </form>
      </CardContent>

      <Dialog open={showTwilioConfirm} onOpenChange={setShowTwilioConfirm}>
        <DialogHeader onClose={() => setShowTwilioConfirm(false)}>
          <DialogTitle>Automatische Anruf-Erkennung einrichten?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">
            Es wird eine eigene Telefonnummer für ca. 1–2 €/Monat bei Twilio eingerichtet, über die verpasste Anrufe
            automatisch erkannt und per SMS beantwortet werden. Anrufe an diese neue Nummer werden an Ihre eben
            gespeicherte Nummer weitergeleitet.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowTwilioConfirm(false)}>
            Später
          </Button>
          <Button type="button" onClick={() => void handleConfirmTwilio()} disabled={provisionTwilio.isPending}>
            {provisionTwilio.isPending ? "Richtet ein …" : "Jetzt einrichten"}
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
