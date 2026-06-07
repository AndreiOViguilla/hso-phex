import { Btn } from "../components/UI";

export default function SuccessPage({ onHome }) {
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 10 }}>Form ready!</div>
        <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
          Your filled PDF has been downloaded. Print it and bring it to your PHEx appointment along with your student ID.
        </div>
        <Btn variant="dark" onClick={onHome}>Back to schedule</Btn>
      </div>
    </div>
  );
}