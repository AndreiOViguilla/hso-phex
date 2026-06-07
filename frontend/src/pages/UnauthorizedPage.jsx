import { useEffect, useState } from "react";

export default function UnauthorizedPage({ onBack }) {
  const [count, setCount] = useState(5);

  // Auto-redirect countdown
  useEffect(() => {
    if (count <= 0) { onBack(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onBack]);

  return (
    <div style={{
      minHeight: "100vh", background: "#f0f2f5",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans','Inter',sans-serif",
      padding: "24px",
    }}>
      {/* Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "#fef2f2", border: "2px solid #fecaca",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 8, textAlign: "center" }}>
        Access Restricted
      </div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8, textAlign: "center", maxWidth: 340, lineHeight: 1.7 }}>
        You need to be signed in to access this page. Please log in with your DLSU account first.
      </div>

      {/* Countdown */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: "12px 20px", marginBottom: 28, fontSize: 13, color: "#6b7280",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        Redirecting in <strong style={{ color: "#dc2626" }}>{count}s</strong>…
      </div>

      {/* Button */}
      <button
        onClick={onBack}
        style={{
          background: "#1d4ed8", color: "#fff", border: "none",
          borderRadius: 10, padding: "13px 32px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Go back now
      </button>

      {/* DLSU branding */}
      <div style={{ marginTop: 40, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        DLSU · Health Services Office · PHEx Portal
      </div>
    </div>
  );
}
