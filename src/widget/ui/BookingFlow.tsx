import { useEffect, useState } from "preact/hooks";
import { bookSlot, fetchSlots } from "../api";
import { CheckIcon, ErrorIcon } from "../icons";

type LoadState = "loading" | "loaded" | "empty" | "error";
type BookState = "idle" | "submitting" | "success" | "error";

interface Props {
  widgetKey: string;
}

function formatSlot(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function BookingFlow({ widgetKey }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookState, setBookState] = useState<BookState>("idle");

  useEffect(() => {
    let cancelled = false;
    fetchSlots(widgetKey)
      .then((res) => {
        if (cancelled) return;
        const next6 = (res.slots ?? []).slice(0, 6);
        setSlots(next6);
        setLoadState(next6.length > 0 ? "loaded" : "empty");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [widgetKey]);

  const canSubmit =
    !!selectedSlot && name.trim().length > 1 && phone.trim().length > 5 && /\S+@\S+\.\S+/.test(email.trim());

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit || bookState === "submitting" || !selectedSlot) return;
    setBookState("submitting");
    try {
      await bookSlot({
        key: widgetKey,
        slotStart: selectedSlot,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setBookState("success");
    } catch {
      setBookState("error");
    }
  }

  if (bookState === "success") {
    return (
      <div class="reachly-state reachly-state-success">
        <CheckIcon />
        <p>Termin gebucht! Sie erhalten in Kürze eine Bestätigung.</p>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div class="reachly-state">
        <span class="reachly-spinner" />
        <p>Freie Termine werden geladen …</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div class="reachly-state reachly-state-error">
        <ErrorIcon />
        <p>Termine konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
      </div>
    );
  }

  if (loadState === "empty") {
    return (
      <div class="reachly-state">
        <p>Aktuell sind keine freien Termine verfügbar.</p>
      </div>
    );
  }

  return (
    <form class="reachly-form" onSubmit={handleSubmit}>
      <div class="reachly-slots">
        {slots.map((slot) => (
          <button
            type="button"
            key={slot}
            class={`reachly-slot-btn${selectedSlot === slot ? " reachly-slot-selected" : ""}`}
            onClick={() => setSelectedSlot(slot)}
          >
            {formatSlot(slot)}
          </button>
        ))}
      </div>

      {selectedSlot && (
        <>
          <div class="reachly-field">
            <label for="reachly-bk-name">Name</label>
            <input
              id="reachly-bk-name"
              type="text"
              value={name}
              required
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="reachly-field">
            <label for="reachly-bk-phone">Telefonnummer</label>
            <input
              id="reachly-bk-phone"
              type="tel"
              value={phone}
              required
              onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="reachly-field">
            <label for="reachly-bk-email">E-Mail (für die Terminbestätigung)</label>
            <input
              id="reachly-bk-email"
              type="email"
              value={email}
              required
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
          </div>
          {bookState === "error" && (
            <p style={{ color: "#dc2626", fontSize: "13px" }}>
              Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.
            </p>
          )}
          <button class="reachly-btn-primary" type="submit" disabled={!canSubmit || bookState === "submitting"}>
            {bookState === "submitting" ? <span class="reachly-spinner" /> : "Termin verbindlich buchen"}
          </button>
        </>
      )}
    </form>
  );
}
