// src/components/Modal.jsx
// Universal modal system — import useModal and ModalProvider anywhere

import { createContext, useContext, useState, useCallback } from "react";
import { useTheme } from "../ThemeContext";

const ModalContext = createContext(null);

// ── Modal types ───────────────────────────────────────────────────────────────
function getIcons(t) {
  return {
    error: (
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.redBg, border: `2px solid ${t.red}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    ),
    success: (
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.greenBg, border: `2px solid ${t.green}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    ),
    warning: (
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.orangeBg, border: `2px solid ${t.orange}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    ),
    confirm: (
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.blueBg, border: `2px solid ${t.blue}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    ),
    info: (
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.blueBg, border: `2px solid ${t.blue}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    ),
  };
}

const TITLES = {
  error:   "Something went wrong",
  success: "Success",
  warning: "Heads up",
  confirm: "Are you sure?",
  info:    "Notice",
};

function getConfirmColors(t) {
  return {
    error:   t.red,
    success: t.green,
    warning: t.orange,
    confirm: t.accent,
    info:    t.accent,
  };
}

// ── The actual modal UI ───────────────────────────────────────────────────────
function ModalUI({ modal, onClose }) {
  if (!modal) return null;
  const { t } = useTheme();
  const { type = "info", title, message, confirmLabel = "OK", cancelLabel = "Cancel", onConfirm, showCancel = false } = modal;
  const ICONS = getIcons(t);
  const CONFIRM_COLORS = getConfirmColors(t);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.35)", textAlign: "center", animation: "modalIn 0.18s ease", fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.93) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {ICONS[type]}

        <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 8 }}>
          {title || TITLES[type]}
        </div>
        <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.65, marginBottom: 24 }}>
          {message}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {showCancel && (
            <button onClick={onClose} style={{ flex: 1, padding: "11px 20px", border: `1.5px solid ${t.cardBorder}`, borderRadius: 10, background: t.card, color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => { if (onConfirm) onConfirm(); onClose(); }}
            style={{ flex: 1, padding: "11px 20px", border: "none", borderRadius: 10, background: CONFIRM_COLORS[type], color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Provider — wrap your app with this ───────────────────────────────────────
export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);
  const close = useCallback(() => setModal(null), []);

  const show = useCallback((options) => {
    // If string passed, treat as error message
    if (typeof options === "string") {
      setModal({ type: "error", message: options });
      return;
    }
    setModal(options);
  }, []);

  return (
    <ModalContext.Provider value={{ show, close }}>
      {children}
      <ModalUI modal={modal} onClose={close} />
    </ModalContext.Provider>
  );
}

// ── Hook — use this anywhere inside ModalProvider ─────────────────────────────
export function useModal() {
  return useContext(ModalContext);
}