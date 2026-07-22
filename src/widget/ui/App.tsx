import { useEffect, useState } from "preact/hooks";
import type { WidgetConfig } from "../types";
import {
  ChatIcon,
  WhatsAppIcon,
  PhoneIcon,
  CalendarIcon,
  CloseIcon,
  BackIcon,
  InstagramIcon,
  FacebookIcon,
  TiktokIcon,
} from "../icons";
import { CallbackForm } from "./CallbackForm";
import { BookingFlow } from "./BookingFlow";

type View = "menu" | "callback" | "booking";

export interface WidgetAppControls {
  open: () => void;
  close: () => void;
}

interface Props {
  config: WidgetConfig;
  exposeControls: (controls: WidgetAppControls) => void;
}

function openWhatsApp(config: WidgetConfig) {
  if (!config.whatsappNumber) return;
  const text = encodeURIComponent(config.whatsappPrefillText ?? "");
  const url = `https://wa.me/${config.whatsappNumber}${text ? `?text=${text}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function WidgetApp({ config, exposeControls }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  useEffect(() => {
    exposeControls({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    });
    // exposeControls kommt vom Aufrufer stabil rein (siehe mount.tsx) - kein Re-Run noetig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    setIsOpen((open) => !open);
    if (isOpen) setView("menu");
  }

  function close() {
    setIsOpen(false);
    setView("menu");
  }

  const posClass = config.position === "left" ? "reachly-pos-left" : "reachly-pos-right";

  const titles: Record<View, string> = {
    menu: config.greeting,
    callback: "Rückruf anfordern",
    booking: "Termin buchen",
  };

  return (
    <>
      <button
        class={`reachly-launcher ${posClass}${isOpen ? " reachly-launcher-open" : ""}`}
        onClick={toggle}
        aria-label={isOpen ? "Kontakt-Widget schließen" : "Kontakt-Widget öffnen"}
      >
        <span class="reachly-launcher-icon reachly-launcher-icon-chat">
          <ChatIcon />
        </span>
        <span class="reachly-launcher-icon reachly-launcher-icon-close">
          <CloseIcon />
        </span>
      </button>

      {isOpen && (
        <div class={`reachly-panel ${posClass}`} role="dialog" aria-label="Kontaktmöglichkeiten">
          <div class="reachly-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {view !== "menu" && (
                <button class="reachly-back-btn" onClick={() => setView("menu")} aria-label="Zurück">
                  <BackIcon />
                </button>
              )}
              <h2>{titles[view]}</h2>
            </div>
            <button class="reachly-close-btn" onClick={close} aria-label="Schließen">
              <CloseIcon />
            </button>
          </div>

          <div class="reachly-body">
            {view === "menu" && (
              <div class="reachly-actions">
                {config.actions.whatsapp && config.whatsappNumber && (
                  <button class="reachly-action-btn" onClick={() => openWhatsApp(config)}>
                    <span class="reachly-action-icon">
                      <WhatsAppIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>WhatsApp-Chat starten</strong>
                      <span>Direkt und schnell antworten lassen</span>
                    </span>
                  </button>
                )}
                {config.actions.callback && (
                  <button class="reachly-action-btn" onClick={() => setView("callback")}>
                    <span class="reachly-action-icon">
                      <PhoneIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>Rückruf anfordern</strong>
                      <span>Wir rufen Sie zurück</span>
                    </span>
                  </button>
                )}
                {config.actions.booking && (
                  <button class="reachly-action-btn" onClick={() => setView("booking")}>
                    <span class="reachly-action-icon">
                      <CalendarIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>Termin buchen</strong>
                      <span>Freien Termin direkt auswählen</span>
                    </span>
                  </button>
                )}
                {config.social.instagram && (
                  <a class="reachly-action-btn" href={config.social.instagram} target="_blank" rel="noopener noreferrer">
                    <span class="reachly-action-icon">
                      <InstagramIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>Instagram</strong>
                      <span>Unser Profil ansehen</span>
                    </span>
                  </a>
                )}
                {config.social.facebook && (
                  <a class="reachly-action-btn" href={config.social.facebook} target="_blank" rel="noopener noreferrer">
                    <span class="reachly-action-icon">
                      <FacebookIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>Facebook</strong>
                      <span>Über den Messenger schreiben</span>
                    </span>
                  </a>
                )}
                {config.social.tiktok && (
                  <a class="reachly-action-btn" href={config.social.tiktok} target="_blank" rel="noopener noreferrer">
                    <span class="reachly-action-icon">
                      <TiktokIcon />
                    </span>
                    <span class="reachly-action-label">
                      <strong>TikTok</strong>
                      <span>Unser Profil ansehen</span>
                    </span>
                  </a>
                )}
              </div>
            )}

            {view === "callback" && <CallbackForm widgetKey={config.key} />}
            {view === "booking" && <BookingFlow widgetKey={config.key} />}
          </div>
        </div>
      )}
    </>
  );
}
