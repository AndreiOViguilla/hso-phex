import { useIsMobile } from "../utils/useIsMobile";
import { NavBar } from "../components/UI";

const STEPS = [
  {
    n: 1,
    title: "Look up your schedule",
    desc: "Enter your student ID on the home screen to see your assigned booking period and exam dates.",
    warn: null,
  },
  {
    n: 2,
    title: "Book your PHEx appointment",
    desc: "Go to your schedule and tap 'Book PHEx appointment'. Choose an available date and 15-minute time slot within your assigned period.",
    warn: null,
  },
  {
    n: 3,
    title: "Book your Drug Test appointment",
    desc: "Do the same for Drug Test — tap 'Book Drug Test appointment' and pick a separate slot.",
    warn: "Doing both on the same day? Pick slots at least 1 hour apart.",
  },
  {
    n: 4,
    title: "Enter your details",
    desc: "Fill in your name, DLSU email, and a personal booking code (any word you'll remember). HSO uses this to cancel duplicate bookings.",
    warn: "⚠ Use your correct DLSU email or you won't receive the confirmation.",
  },
  {
    n: 5,
    title: "Confirm your slot",
    desc: "Review your appointment details and tap Schedule Event. A confirmation will be sent to your DLSU email.",
    warn: null,
  },
  {
    n: 6,
    title: "Show confirmation at the station",
    desc: "On your appointment day, present the confirmation email to the guard at the PHEx or Drug Test station.",
    warn: null,
  },
  {
    n: 7,
    title: "Need to reschedule?",
    desc: "Contact HSO directly at phex@dlsu.edu.ph or call (632) 8524-4611 local 221 to change your slot.",
    warn: null,
  },
];

export default function BookingGuidePage({ onBack }) {
  const isMobile = useIsMobile();

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <NavBar title="Booking Guide" sub="PHEx & Drug Test Appointment Guide" onBack={onBack} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "16px" : "32px 40px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 0 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 14, marginBottom: 20, paddingRight: isMobile ? 0 : 24 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                {s.n}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>{s.desc}</div>
                {s.warn && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#92400e", marginTop: 8 }}>
                    {s.warn}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>Booking concerns?</div>
          <div style={{ fontSize: 13, color: "#0369a1", lineHeight: 1.6 }}>
            Having trouble booking or didn't receive your confirmation?<br />
            Email <a href="mailto:phex@dlsu.edu.ph" style={{ color: "#0369a1", fontWeight: 700 }}>phex@dlsu.edu.ph</a> or call (632) 8524-4611 local 221.
          </div>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
