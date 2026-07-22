// Alle Styles leben ausschliesslich im Shadow Root. Kein globales CSS, kein
// Tailwind - das CSS der Host-Website darf das Widget nicht beeinflussen und
// umgekehrt.
export function widgetCss(accentColor: string): string {
  return /* css */ `
    :host {
      all: initial;
    }

    .reachly-root {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      --reachly-accent: ${accentColor};
      --reachly-accent-fg: #ffffff;
      --reachly-fg: #1f2937;
      --reachly-muted: #6b7280;
      --reachly-border: #e5e7eb;
      --reachly-bg: #ffffff;
      font-size: 14px;
      line-height: 1.45;
      color: var(--reachly-fg);
    }

    .reachly-root * {
      box-sizing: border-box;
    }

    /* button/input/textarea erben font-family per UA-Stylesheet NICHT automatisch -
       ohne diesen Reset wuerden Formularelemente die Browser-Standardschrift zeigen
       statt der konfigurierten Systemschrift (kein Host-CSS-Leak, sondern UA-Default). */
    .reachly-root button,
    .reachly-root input,
    .reachly-root textarea {
      font-family: inherit;
    }

    .reachly-launcher {
      position: fixed;
      bottom: 20px;
      z-index: 2147483000;
      width: 56px;
      height: 56px;
      border-radius: 999px;
      border: none;
      background: var(--reachly-accent);
      color: var(--reachly-accent-fg);
      box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--reachly-accent) 65%, transparent), 0 2px 6px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
    }
    .reachly-launcher:hover {
      transform: scale(1.06);
      box-shadow: 0 10px 28px -6px color-mix(in srgb, var(--reachly-accent) 75%, transparent), 0 2px 6px rgba(0, 0, 0, 0.14);
    }
    .reachly-launcher:active {
      transform: scale(0.96);
    }
    .reachly-launcher-icon {
      position: absolute;
      display: flex;
      transition: opacity 0.18s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .reachly-launcher-icon-close {
      opacity: 0;
      transform: rotate(-45deg) scale(0.7);
    }
    .reachly-launcher-icon-chat {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    .reachly-launcher-open .reachly-launcher-icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    .reachly-launcher-open .reachly-launcher-icon-chat {
      opacity: 0;
      transform: rotate(45deg) scale(0.7);
    }
    .reachly-launcher.reachly-pos-right {
      right: 20px;
    }
    .reachly-launcher.reachly-pos-left {
      left: 20px;
    }

    .reachly-panel {
      position: fixed;
      z-index: 2147483001;
      bottom: 88px;
      width: 360px;
      max-width: calc(100vw - 40px);
      max-height: min(560px, 75vh);
      background: var(--reachly-bg);
      border-radius: 16px;
      box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid var(--reachly-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: bottom right;
      animation: reachly-panel-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reachly-panel.reachly-pos-left {
      transform-origin: bottom left;
    }
    @keyframes reachly-panel-in {
      from {
        opacity: 0;
        transform: scale(0.94) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    .reachly-panel.reachly-pos-right {
      right: 20px;
    }
    .reachly-panel.reachly-pos-left {
      left: 20px;
    }

    @keyframes reachly-panel-in-mobile {
      from {
        opacity: 0;
        transform: translateY(100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (max-width: 480px) {
      .reachly-panel {
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        max-width: 100%;
        max-height: 80vh;
        border-radius: 16px 16px 0 0;
        transform-origin: bottom center;
        animation-name: reachly-panel-in-mobile;
      }
    }

    .reachly-header {
      background: linear-gradient(155deg, var(--reachly-accent), color-mix(in srgb, var(--reachly-accent) 80%, black));
      color: var(--reachly-accent-fg);
      padding: 18px 16px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .reachly-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .reachly-close-btn,
    .reachly-back-btn {
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      opacity: 0.85;
      transition: opacity 0.15s, background 0.15s, transform 0.15s;
    }
    .reachly-close-btn:hover,
    .reachly-back-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }
    .reachly-back-btn:hover {
      transform: translateX(-2px);
    }

    .reachly-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    .reachly-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .reachly-action-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: left;
      text-decoration: none;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid var(--reachly-border);
      background: #fafafa;
      cursor: pointer;
      font-size: 14px;
      color: var(--reachly-fg);
      transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    }
    .reachly-action-btn:hover {
      background: #ffffff;
      border-color: var(--reachly-accent);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.12);
    }
    .reachly-action-btn:active {
      transform: translateY(0);
    }
    .reachly-action-icon {
      color: var(--reachly-accent);
      background: color-mix(in srgb, var(--reachly-accent) 12%, white);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 9px;
      transition: background 0.15s;
    }
    .reachly-action-btn:hover .reachly-action-icon {
      background: color-mix(in srgb, var(--reachly-accent) 18%, white);
    }
    .reachly-action-label strong {
      display: block;
      font-size: 14px;
    }
    .reachly-action-label span {
      color: var(--reachly-muted);
      font-size: 12px;
    }

    .reachly-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .reachly-field label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--reachly-muted);
    }
    .reachly-field input,
    .reachly-field textarea {
      width: 100%;
      padding: 9px 10px;
      border-radius: 8px;
      border: 1px solid var(--reachly-border);
      font-size: 14px;
      font-family: inherit;
      color: var(--reachly-fg);
      background: #fff;
    }
    .reachly-field input:focus,
    .reachly-field textarea:focus {
      outline: 2px solid var(--reachly-accent);
      outline-offset: 1px;
      border-color: var(--reachly-accent);
    }
    .reachly-field input,
    .reachly-field textarea {
      transition: border-color 0.15s;
    }

    .reachly-btn-primary {
      background: var(--reachly-accent);
      color: var(--reachly-accent-fg);
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
      box-shadow: 0 2px 8px -3px color-mix(in srgb, var(--reachly-accent) 60%, transparent);
    }
    .reachly-btn-primary:hover:not(:disabled) {
      filter: brightness(1.06);
      box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--reachly-accent) 65%, transparent);
    }
    .reachly-btn-primary:active:not(:disabled) {
      transform: scale(0.98);
    }
    .reachly-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }
    .reachly-btn-secondary {
      background: transparent;
      color: var(--reachly-fg);
      border: 1px solid var(--reachly-border);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .reachly-btn-secondary:hover {
      background: #f8f8f8;
    }

    .reachly-state {
      text-align: center;
      padding: 20px 8px;
      animation: reachly-fade-up 0.3s ease;
    }
    .reachly-state p {
      margin: 8px 0 16px;
      color: var(--reachly-muted);
    }
    .reachly-state-icon {
      animation: reachly-icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .reachly-state.reachly-state-success .reachly-state-icon {
      color: #059669;
    }
    .reachly-state.reachly-state-error .reachly-state-icon {
      color: #dc2626;
    }
    @keyframes reachly-fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes reachly-icon-pop {
      from { transform: scale(0.6); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .reachly-slots {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }
    .reachly-slot-btn {
      padding: 10px 8px;
      border-radius: 8px;
      border: 1px solid var(--reachly-border);
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
      font-size: 13px;
      color: var(--reachly-fg);
    }
    .reachly-slot-btn:hover {
      border-color: var(--reachly-accent);
      color: var(--reachly-accent);
      transform: translateY(-1px);
    }
    .reachly-slot-btn.reachly-slot-selected {
      background: var(--reachly-accent);
      border-color: var(--reachly-accent);
      color: var(--reachly-accent-fg);
      box-shadow: 0 4px 10px -4px color-mix(in srgb, var(--reachly-accent) 60%, transparent);
    }

    .reachly-spinner {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-top-color: var(--reachly-accent);
      animation: reachly-spin 0.7s linear infinite;
      margin: 0 auto;
    }
    @keyframes reachly-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
}
