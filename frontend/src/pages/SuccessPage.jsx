import { useTheme } from "../ThemeContext";

export default function SuccessPage({ onHome }) {
  const { t } = useTheme();
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 24px", background: t.bg }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: t.greenBg, border: `2px solid ${t.green}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 10 }}>Form ready!</div>
        <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.7, marginBottom: 24 }}>
          Your filled PDF has been generated and downloaded to your device.
        </div>
        <button onClick={onHome} style={{ padding: "13px 32px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Back to schedule
        </button>
      </div>
    </div>
  );
}