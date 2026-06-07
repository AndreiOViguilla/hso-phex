export function NavBar({ title, sub, onBack }) {
  return (
    <div style={{ background: "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          ←
        </button>
      )}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Badge({ label, type }) {
  const colors = {
    green:  { background: "#dcfce7", color: "#166534" },
    yellow: { background: "#fef9c3", color: "#854d0e" },
    blue:   { background: "#dbeafe", color: "#1e40af" },
    gray:   { background: "#f3f4f6", color: "#374151" },
  };
  return (
    <span style={{ ...colors[type || "gray"], fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", style }) {
  const variants = {
    primary: { background: "#1d4ed8", color: "#fff", border: "none" },
    dark:    { background: "#111827", color: "#fff", border: "none" },
    outline: { background: "#fff",    color: "#1d4ed8", border: "1.5px solid #1d4ed8" },
    success: { background: "#16a34a", color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick} style={{ ...variants[variant], width: "100%", padding: "13px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", ...style }}>
      {children}
    </button>
  );
}
