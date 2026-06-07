import { useIsMobile } from "../utils/useIsMobile";

const IconCalendar = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5"/>
    <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5"/>
    <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5"/>
    <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5"/>
    <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5"/>
  </svg>
);

const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.38 2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.92 17z"/>
  </svg>
);

const IconWarning = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 5, flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function HomePage({ onLogin, onGuide }) {
  const isMobile = useIsMobile();

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>

      {/* Hero — full width building photo with blue gradient overlay */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: isMobile ? 260 : 380, color: "#fff" }}>
        {/* Building photo — full background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url(/dlsu-building.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }} />
        {/* Blue gradient overlay — dark on bottom-left, lighter on top-right */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(30,58,138,0.92) 0%, rgba(29,78,216,0.80) 50%, rgba(29,78,216,0.45) 100%)",
        }} />

        {/* Text content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: isMobile ? "36px 20px 40px" : "64px 40px 56px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", opacity: 0.8, marginBottom: 10, textTransform: "uppercase" }}>
            DLSU · Health Services Office
          </div>
          <div style={{ fontSize: isMobile ? 30 : 44, fontWeight: 800, lineHeight: 1.2, marginBottom: 10 }}>
            PHEx & Drug Test<br />AY 2025–2026
          </div>
          <div style={{ fontSize: isMobile ? 13 : 15, opacity: 0.8, marginBottom: 28 }}>
            Manila Campus Undergraduates · June 8 – July 31, 2026
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onLogin} style={{
              background: "#fff", color: "#1d4ed8", border: "none", borderRadius: 10,
              padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Sign in / Register →
            </button>
            <button onClick={onGuide} style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.45)",
              borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Booking guide
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Schedule table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Schedule at a glance
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #e5e7eb" }}>
                {["ID prefix", "Exam period", "Booking opens"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["125", "June 8 – 19", "June 5"],
                ["124", "June 20 – July 4", "June 17"],
                ["123", "July 6 – 16", "July 3"],
                ["122", "July 17 – 27", "July 17"],
                ["121 and below", "July 28 – 31", "July 25"],
              ].map(([prefix, exam, book], i) => (
                <tr key={prefix} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1d4ed8" }}>{prefix}</td>
                  <td style={{ padding: "10px 12px", color: "#111827" }}>{exam}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{book}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* What you need to do */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
            What you need to do
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { n: 1, text: "Sign in or register to access your personal schedule" },
              { n: 2, text: "Book your PHEx and Drug Test appointments separately" },
              { n: 3, text: "Fill and print your MEF and DEF forms" },
              { n: 4, text: "Attend your PHEx and Drug Test on your scheduled dates" },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{text}</div>
              </div>
            ))}
          </div>
          <button onClick={onLogin} style={{
            width: "100%", marginTop: 16, padding: "12px", background: "#1d4ed8", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            Get started →
          </button>
        </div>

        {/* Booking guide quick link */}
        <div onClick={onGuide} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flexShrink: 0 }}><IconCalendar /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Booking guide</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>How to schedule your appointment</div>
          </div>
          <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 18 }}>›</div>
        </div>

        {/* Deadline reminder */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4, display: "flex", alignItems: "center" }}>
            <IconWarning /> Important deadline
          </div>
          <div style={{ fontSize: isMobile ? 12 : 13, color: "#92400e", lineHeight: 1.6 }}>
            Have health results from Jan 1, 2026? Submit to HSO by <strong>June 30, 2026</strong> instead of doing the on-site PHEx.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14, fontSize: 12, color: "#9ca3af", lineHeight: 1.8, display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center" }}>
          <span><IconMail /><a href="mailto:phex@dlsu.edu.ph" style={{ color: "#1d4ed8" }}>phex@dlsu.edu.ph</a></span>
          <span><IconMail /><a href="mailto:clinic@dlsu.edu.ph" style={{ color: "#1d4ed8" }}>clinic@dlsu.edu.ph</a></span>
          <span><IconPhone />(632) 8524-4611 local 221</span>
        </div>
      </div>
    </div>
  );
}
