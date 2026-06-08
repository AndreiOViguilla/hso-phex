import { useIsMobile } from "../utils/useIsMobile";
import { useTheme } from "../ThemeContext";

const IconCalendar = ({ color }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5"/><line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5"/><line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5"/><line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5"/><line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5"/>
  </svg>
);
const IconMail = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconPhone = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.38 2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.92 17z"/>
  </svg>
);
const IconWarning = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 5, flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function HomePage({ onLogin, onGuide }) {
  const isMobile = useIsMobile();
  const { dark, toggle, t } = useTheme();

  return (
    <div style={{ flex: 1, overflowY: "auto", background: t.bg }}>
      {/* Dark mode toggle — top right */}
      <div style={{ position: "absolute", top: 12, right: 16, zIndex: 10 }}>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: isMobile ? 260 : 380, color: "#fff" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(/dlsu-building.png)", backgroundSize: "cover", backgroundPosition: "center 30%" }} />
        <div style={{ position: "absolute", inset: 0, background: dark ? "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.88) 50%, rgba(30,41,59,0.6) 100%)" : "linear-gradient(135deg, rgba(30,58,138,0.92) 0%, rgba(29,78,216,0.80) 50%, rgba(29,78,216,0.45) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: isMobile ? "36px 20px 40px" : "64px 40px 56px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", opacity: 0.8, marginBottom: 10, textTransform: "uppercase" }}>DLSU · Health Services Office</div>
          <div style={{ fontSize: isMobile ? 30 : 44, fontWeight: 800, lineHeight: 1.2, marginBottom: 10 }}>PHEx & Drug Test<br />AY 2025–2026</div>
          <div style={{ fontSize: isMobile ? 13 : 15, opacity: 0.8, marginBottom: 28 }}>Manila Campus Undergraduates · June 8 – July 31, 2026</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onLogin} style={{ background: dark ? t.accentBtn : "#fff", color: dark ? "#fff" : "#1d4ed8", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sign in / Register →</button>
            <button onClick={onGuide} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.45)", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Booking guide</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Schedule table */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Schedule at a glance</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${t.divider}` }}>
                {["ID prefix", "Exam period", "Booking opens"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[["125","June 8 – 19","June 5"],["124","June 20 – July 4","June 17"],["123","July 6 – 16","July 3"],["122","July 17 – 27","July 17"],["121 and below","July 28 – 31","July 25"]].map(([prefix, exam, book], i) => (
                <tr key={prefix} style={{ background: i % 2 === 0 ? t.card : (dark ? "#162032" : "#f9fafb"), borderBottom: `1px solid ${t.divider}` }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: t.accent }}>{prefix}</td>
                  <td style={{ padding: "10px 12px", color: t.text }}>{exam}</td>
                  <td style={{ padding: "10px 12px", color: t.textSub }}>{book}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* What you need to do */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>What you need to do</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { n: 1, text: "Sign in or register to access your personal schedule" },
              { n: 2, text: "Book your PHEx and Drug Test appointments separately" },
              { n: 3, text: "Fill and print your MEF and DEF forms" },
              { n: 4, text: "Attend your PHEx and Drug Test on your scheduled dates" },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: t.accentBg, color: t.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
                <div style={{ fontSize: 13, color: t.textSub }}>{text}</div>
              </div>
            ))}
          </div>
          <button onClick={onLogin} style={{ width: "100%", marginTop: 16, padding: "12px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Get started →
          </button>
        </div>

        {/* Booking guide link */}
        <div onClick={onGuide} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flexShrink: 0 }}><IconCalendar color={t.accent} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>Booking guide</div>
            <div style={{ fontSize: 12, color: t.textSub }}>How to schedule your appointment</div>
          </div>
          <div style={{ marginLeft: "auto", color: t.textMuted, fontSize: 18 }}>›</div>
        </div>

        {/* Deadline reminder */}
        <div style={{ background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.orangeText, marginBottom: 4, display: "flex", alignItems: "center" }}>
            <IconWarning color={t.orangeText} /> Important deadline
          </div>
          <div style={{ fontSize: isMobile ? 12 : 13, color: t.orangeText, lineHeight: 1.6 }}>
            Have health results from Jan 1, 2026? Submit to HSO by <strong>June 30, 2026</strong> instead of doing the on-site PHEx.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: 14, fontSize: 12, color: t.textMuted, lineHeight: 1.8, display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center" }}>
          <span><IconMail color={t.accent} /><a href="mailto:phex@dlsu.edu.ph" style={{ color: t.accent }}>phex@dlsu.edu.ph</a></span>
          <span><IconMail color={t.accent} /><a href="mailto:clinic@dlsu.edu.ph" style={{ color: t.accent }}>clinic@dlsu.edu.ph</a></span>
          <span><IconPhone color={t.textMuted} />(632) 8524-4611 local 221</span>
        </div>
      </div>
    </div>
  );
}