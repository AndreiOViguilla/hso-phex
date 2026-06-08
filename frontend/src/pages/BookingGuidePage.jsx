import { useIsMobile } from "../utils/useIsMobile";
import { useTheme } from "../ThemeContext";

const STEPS = [
  { n: 1, title: "Look up your schedule", desc: "Enter your student ID on the home screen to see your assigned booking period and exam dates.", warn: null },
  { n: 2, title: "Book your PHEx appointment", desc: "Go to your schedule and tap 'Book PHEx appointment'. Choose an available date and 15-minute time slot within your assigned period.", warn: null },
  { n: 3, title: "Book your Drug Test appointment", desc: "Do the same for Drug Test — tap 'Book Drug Test appointment' and pick a separate slot.", warn: "Doing both on the same day? Pick slots at least 1 hour apart." },
  { n: 4, title: "Enter your details", desc: "Fill in your name, DLSU email, and a personal booking code (any word you'll remember). HSO uses this to cancel duplicate bookings.", warn: "Use your correct DLSU email or you won't receive the confirmation." },
  { n: 5, title: "Confirm your slot", desc: "Review your appointment details and tap Schedule Event. A confirmation will be sent to your DLSU email.", warn: null },
  { n: 6, title: "Show confirmation at the station", desc: "On your appointment day, present the confirmation email to the guard at the PHEx or Drug Test station.", warn: null },
  { n: 7, title: "Need to reschedule?", desc: "Contact HSO directly at phex@dlsu.edu.ph or call (632) 8524-4611 local 221 to change your slot.", warn: null },
];

export default function BookingGuidePage({ onBack }) {
  const isMobile = useIsMobile();
  const { t } = useTheme();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: t.bg }}>
      <div style={{ background: "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Booking Guide</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>How to schedule your PHEx & Drug Test</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "32px 40px", maxWidth: 700, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {STEPS.map(({ n, title, desc, warn }) => (
            <div key={n} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.accentBg, color: t.accent, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.65 }}>{desc}</div>
                {warn && (
                  <div style={{ marginTop: 10, background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.orangeText, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.orangeText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {warn}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Contact */}
          <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Contact HSO</div>
            <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.8 }}>
              <div><a href="mailto:phex@dlsu.edu.ph" style={{ color: t.accent }}>phex@dlsu.edu.ph</a></div>
              <div><a href="mailto:clinic@dlsu.edu.ph" style={{ color: t.accent }}>clinic@dlsu.edu.ph</a></div>
              <div style={{ color: t.textSub }}>(632) 8524-4611 local 221</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}