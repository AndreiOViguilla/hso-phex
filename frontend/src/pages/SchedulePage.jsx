import { useState, useEffect } from "react";
import { daysUntil } from "../utils/schedule";
import { useIsMobile } from "../utils/useIsMobile";
import { Badge, Card, SectionLabel, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";
import { getAuthHeader } from "../App";
import { useModal } from "../components/Modal";

const IconLocation = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconClock = ({ color }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconInfo = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconFile = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconCheck = ({ color = "#16a34a" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconTimer = ({ color = "#1d4ed8" }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CHECKLIST_PHEX = [
  { id: "mef",     label: "Bring printed Medical Examination Form (MEF)" },
  { id: "id",      label: "Bring your DLSU ID or any valid government ID" },
  { id: "fast",    label: "Fasting — no food or drink 8 hours before blood test" },
  { id: "clothes", label: "Wear comfortable, loose clothing (for physical exam)" },
  { id: "glasses", label: "Wear glasses/contacts if needed (for eye exam)" },
  { id: "arrive",  label: "Arrive 10 minutes early at Waldo Perfecto Seminar Room" },
];
const CHECKLIST_DT = [
  { id: "def",       label: "Bring printed Dental Examination Form (DEF)" },
  { id: "id_dt",     label: "Bring your DLSU ID or any valid government ID" },
  { id: "water",     label: "Drink plenty of water before the drug test" },
  { id: "avoid",     label: "Avoid excessive exercise 24 hours before the test" },
  { id: "arrive_dt", label: "Arrive 10 minutes early at ERSC 2nd floor" },
];

function useCountdown(dateStr, timeStr) {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!dateStr || !timeStr) return;
    const update = () => {
      try {
        const [timePart, ampm] = [timeStr.slice(0, -2), timeStr.slice(-2)];
        let [h, m] = timePart.split(":").map(Number);
        if (ampm === "pm" && h !== 12) h += 12;
        if (ampm === "am" && h === 12) h = 0;
        const target = new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);
        const diff = target - new Date();
        if (diff <= 0) { setCountdown("Now!"); return; }
        const days  = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins  = Math.floor((diff % 3600000) / 60000);
        if (days > 0)       setCountdown(`${days}d ${hours}h ${mins}m`);
        else if (hours > 0) setCountdown(`${hours}h ${mins}m`);
        else                setCountdown(`${mins} min`);
      } catch { setCountdown(""); }
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [dateStr, timeStr]);
  return countdown;
}

function formatBookingDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function StepRow({ n, active, done, lineColor, isLast, children, t }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 36 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: active ? t.stepActive : done ? t.stepDone : t.card,
          border: `2px solid ${active ? t.stepActive : done ? t.stepDone : t.cardBorder}`,
          color: active || done ? "#fff" : t.textMuted,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
          boxShadow: active ? `0 0 0 4px ${t.stepActive}33, 0 0 14px ${t.stepActive}55` : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
          transition: "all 0.3s ease",
        }}>
          {done ? <IconCheck color="#fff" /> : n}
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 24, background: lineColor, marginTop: 4, transition: "background 0.3s" }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 28, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function SchedulePage({ studentId, sched, onBack, onGuide, onMEF, onBookPHEx, onBookDT, onDEF, phexBooking: initPhex, dtBooking: initDT, onLogout, onProfile }) {
  const isMobile = useIsMobile();
  const now = new Date();
  const { dark, toggle, t } = useTheme();
  const { show } = useModal();

  const [bookedPHEx,    setBookedPHEx]    = useState(initPhex || null);
  const [bookedDT,      setBookedDT]      = useState(initDT   || null);
  const [filledMEF,     setFilledMEF]     = useState(false);
  const [filledDEF,     setFilledDEF]     = useState(false);
  const [checked,       setChecked]       = useState([]);
  const [rescheduleFor,    setRescheduleFor]    = useState(null);
  const [expandedSections, setExpandedSections] = useState({ phex: false, dt: false });
  const [rescheduleCode,setRescheduleCode]= useState("");
  const [forgotCodeLoading, setForgotCodeLoading] = useState(false);

  const [showForgotCode, setShowForgotCode] = useState(false);
  const [forgotCodeEmail, setForgotCodeEmail] = useState("");

  const handleForgotCode = async () => {
    if (!forgotCodeEmail.includes("@")) { show({ type: "error", message: "Enter your email address." }); return; }
    setForgotCodeLoading(true);
    try {
      const resp = await fetch("/api/auth/forgot-booking-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotCodeEmail }),
      });
      const data = await resp.json();
      if (data.error) { show({ type: "error", message: data.error }); }
      else { show({ type: "success", title: "Email sent!", message: data.message }); setShowForgotCode(false); setForgotCodeEmail(""); }
    } catch { show({ type: "error", message: "Could not connect to server." }); }
    setForgotCodeLoading(false);
  };

  // Reset Steps 2-4 progress when either booking is dropped
  useEffect(() => {
    if (!bookedPHEx || !bookedDT) {
      // Clear local state
      setFilledMEF(false);
      setFilledDEF(false);
      setChecked([]);
      // Reset in backend
      fetch("/api/students/me/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ filledMEF: false, filledDEF: false, checklist: [] }),
      }).catch(() => {});
    }
  }, [bookedPHEx, bookedDT]);

  const allItems = [...CHECKLIST_PHEX, ...CHECKLIST_DT];
  const checklistDone = allItems.every(item => checked.includes(item.id));

  useEffect(() => {
    fetch("/api/students/me", { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) return;
        if (user.checklist) setChecked(user.checklist);
        if (user.filledMEF) setFilledMEF(user.filledMEF);
        if (user.filledDEF) setFilledDEF(user.filledDEF);
      })
      .catch(() => {});
  }, []);

  const saveProgress = (updates) => {
    fetch("/api/students/me/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(updates),
    }).catch(() => {});
  };

  const toggleCheck = (id) => {
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
    setChecked(next);
    saveProgress({ checklist: next });
  };

  const phexPast = bookedPHEx ? new Date(bookedPHEx.date + "T23:59:59") < new Date() : false;
  const dtPast   = bookedDT   ? new Date(bookedDT.date   + "T23:59:59") < new Date() : false;
  const phexCountdown = useCountdown(bookedPHEx?.date, bookedPHEx?.time);
  const dtCountdown   = useCountdown(bookedDT?.date,   bookedDT?.time);
  const phexNow = phexCountdown === "Now!";
  const dtNow   = dtCountdown   === "Now!";

  const currentStep = (() => {
    if (!bookedPHEx || !bookedDT || phexPast || dtPast || phexNow || dtNow) return 1;
    if (!filledMEF || !filledDEF) return 2;
    if (!checklistDone) return 3;
    return 4;
  })();

  let bookBadge, bookingOpen = false;
  if (now < sched.bookStart) {
    const d = daysUntil(sched.bookStart);
    bookBadge = { label: `Opens in ${d} day${d !== 1 ? "s" : ""}`, type: "yellow" };
  } else if (now <= sched.bookEnd) {
    bookBadge = { label: "Open now", type: "green" };
    bookingOpen = true;
  } else {
    bookBadge = { label: "Closed", type: "gray" };
  }
  const d2 = daysUntil(sched.examStart);
  const examBadge = now < sched.examStart
    ? { label: `In ${d2} day${d2 !== 1 ? "s" : ""}`, type: "blue" }
    : { label: "Active", type: "green" };

  const BookedCard = ({ label, color, bgColor, booking, countdown, onReschedule }) => {
    const isPast      = new Date(booking.date + "T23:59:59") < new Date();
    const isNow       = countdown === "Now!";
    const isNowOrPast = isPast || isNow;
    const borderCol   = isNowOrPast ? t.orange : t.green;
    const countBg     = isNowOrPast ? t.orangeBg : t.blueBg;
    const countCol    = isNowOrPast ? t.orangeText : t.blueText;
    return (
      <div style={{ background: t.card, border: `1.5px solid ${borderCol}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ background: bgColor, color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{label}</span>
          {!isNowOrPast && <span style={{ fontSize: 11, color: t.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><IconCheck color={t.green} /> Booked</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
          {formatBookingDate(booking.date)} at {booking.time}
        </div>
        {countdown && (
          <div style={{ background: countBg, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: countCol, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center" }}>
            <IconTimer color={countCol} />
            {isPast ? "Appointment passed" : isNow ? "Your appointment is already passed" : `${countdown} until appointment`}
          </div>
        )}
        {(isPast || isNow) && (
          <div style={{ background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 8, padding: "8px 10px", fontSize: 11, color: t.orangeText, marginBottom: 10, lineHeight: 1.5 }}>
            {isPast ? "Your appointment date has passed." : "Your appointment time has already passed."} Please find another appointment.
          </div>
        )}
        <button onClick={onReschedule} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px solid ${isNowOrPast ? t.orange : t.cardBorder}`, background: isNowOrPast ? t.orangeBg : t.card, color: isNowOrPast ? t.orangeText : t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Change appointment
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: t.bg }}>
      {/* NavBar */}
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Your Schedule</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>ID: {studentId}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button onClick={onProfile} title="Edit profile" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Reschedule modal */}
      {rescheduleFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", textAlign: "center", fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.orangeBg, border: `2px solid ${t.orange}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 8 }}>Change {rescheduleFor === "phex" ? "PHEx" : "Drug Test"} Appointment</div>
            <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.65, marginBottom: 20 }}>Enter your personal booking code to verify before rescheduling.</div>
            <input placeholder="e.g. pikachu" value={rescheduleCode} onChange={e => setRescheduleCode(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10, textAlign: "center", background: t.input, color: t.text }}
              autoFocus
            />
            {/* Forgot booking code */}
            {!showForgotCode ? (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button onClick={() => setShowForgotCode(true)} style={{ background: "none", border: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Forgot your booking code?
                </button>
              </div>
            ) : (
              <div style={{ background: t.bg, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>We'll email your booking code to your DLSU email.</div>
                <input
                  placeholder="you@dlsu.edu.ph"
                  value={forgotCodeEmail}
                  onChange={e => setForgotCodeEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgotCode()}
                  style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: t.input, color: t.text, marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowForgotCode(false); setForgotCodeEmail(""); }} style={{ flex: 1, padding: "8px", border: `1px solid ${t.cardBorder}`, borderRadius: 8, background: t.card, color: t.textSub, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={handleForgotCode} disabled={forgotCodeLoading} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: t.accentBtn, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: forgotCodeLoading ? 0.7 : 1 }}>
                    {forgotCodeLoading ? "Sending…" : "Send code"}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRescheduleFor(null); setShowForgotCode(false); setForgotCodeEmail(""); }} style={{ flex: 1, padding: "11px", border: `1.5px solid ${t.cardBorder}`, borderRadius: 10, background: t.card, color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => {
                const bookingCode = rescheduleFor === "phex" ? bookedPHEx?.code : bookedDT?.code;
                if (!rescheduleCode.trim()) { show({ type: "error", message: "Please enter your booking code." }); return; }
                if (rescheduleCode.trim() !== bookingCode) { show({ type: "error", message: "Incorrect booking code. Please try again." }); return; }
                if (rescheduleFor === "phex") { setBookedPHEx(null); onBookPHEx(); }
                else { setBookedDT(null); onBookDT(); }
                setRescheduleFor(null);
              }} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 10, background: t.accentBtn, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "16px" : "32px 40px", width: "100%", boxSizing: "border-box" }}>

        {/* Period cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 28 }}>
          <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Appointment booking</span>
              <Badge {...bookBadge} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{sched.book}</div>
            <div style={{ fontSize: 12, color: t.textSub, marginTop: 6, lineHeight: 1.6 }}>Book PHEx and DT <strong>separately</strong>. Space at least 1 hour apart if doing both on the same day.</div>
          </div>
          <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Exam period</span>
              <Badge {...examBadge} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{sched.exam}</div>
            <div style={{ fontSize: 12, color: t.textSub, marginTop: 6 }}>Each appointment is 15 minutes. Show your confirmation email to the guard at each station.</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Step 1 */}
          <StepRow n={1} t={t} active={currentStep === 1} done={!!bookedPHEx && !!bookedDT && !phexPast && !dtPast && !phexNow && !dtNow} lineColor={bookedPHEx && bookedDT && !phexPast && !dtPast ? t.stepLineDone : t.stepLine} isLast={false}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4, paddingTop: 6 }}>Step 1 — Book your appointments</div>
            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 12 }}>Book your PHEx and Drug Test appointments separately. Space at least 1 hour apart if on the same day.</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {bookedPHEx ? (
                <BookedCard label="PHEx" color={t.blue} bgColor={t.blueBg} booking={bookedPHEx} countdown={phexCountdown} onReschedule={() => { setRescheduleCode(""); setRescheduleFor("phex"); }} />
              ) : (
                <div style={{ background: t.card, border: `1.5px solid ${t.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ background: t.blueBg, color: t.blue, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>PHEx</span></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Periodic Health Examination</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><IconLocation color={t.blue} /><div><div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Waldo Perfecto Seminar Room</div><div style={{ fontSize: 11, color: t.textSub }}>Ground floor, Br. Connon Hall</div></div></div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}><IconInfo color={t.textSub} /><div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.5 }}>Bring your MEF. Results claimed 10 days after procedure.</div></div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}><IconClock color={t.textMuted} />Mon–Fri 8am–12nn, 1pm–6pm · Sat 8am–1pm</div>
                  <button onClick={bookingOpen ? onBookPHEx : undefined} disabled={!bookingOpen} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${bookingOpen ? t.accent : t.cardBorder}`, background: bookingOpen ? t.accentBg : t.card, color: bookingOpen ? t.accent : t.textMuted, fontSize: 12, fontWeight: 700, cursor: bookingOpen ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{bookingOpen ? "Book PHEx appointment →" : "Booking not yet open"}</button>
                </div>
              )}
              {bookedDT ? (
                <BookedCard label="Drug Test" color={t.teal} bgColor={t.tealBg} booking={bookedDT} countdown={dtCountdown} onReschedule={() => { setRescheduleCode(""); setRescheduleFor("dt"); }} />
              ) : (
                <div style={{ background: t.card, border: `1.5px solid ${t.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ background: t.tealBg, color: t.teal, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>Drug Test</span></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Drug Testing (LFAD Program)</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><IconLocation color={t.teal} /><div><div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>2nd floor, Enrique Razon Sports Center</div><div style={{ fontSize: 11, color: t.textSub }}>ERSC — across from the main gym</div></div></div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}><IconInfo color={t.textSub} /><div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.5 }}>Mandatory under Section 1.20.3. Results available from June 30.</div></div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}><IconClock color={t.textMuted} />Mon–Fri 8am–12nn, 1pm–6pm · Sat 8am–1pm</div>
                  <button onClick={bookingOpen ? onBookDT : undefined} disabled={!bookingOpen} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${bookingOpen ? t.teal : t.cardBorder}`, background: bookingOpen ? t.tealBg : t.card, color: bookingOpen ? t.teal : t.textMuted, fontSize: 12, fontWeight: 700, cursor: bookingOpen ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{bookingOpen ? "Book Drug Test appointment →" : "Booking not yet open"}</button>
                </div>
              )}
            </div>
          </StepRow>

          {/* Step 2 */}
          <StepRow n={2} t={t} active={currentStep === 2} done={filledMEF && filledDEF} lineColor={filledMEF && filledDEF ? t.stepLineDone : t.stepLine} isLast={false}>
            <div style={{ fontSize: 15, fontWeight: 700, color: currentStep >= 2 ? t.text : t.textMuted, marginBottom: 4, paddingTop: 6 }}>Step 2 — Fill your forms</div>
            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 8 }}>Fill and download both MEF and DEF forms, then mark each as complete.</div>
            {currentStep < 2 ? (
              <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Book both PHEx and Drug Test appointments first.
              </div>
            ) : (
              <>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {[
                { key: "mef", label: "Medical Examination Form", desc: "Fill in your student details, print, and bring to your PHEx appointment.", filled: filledMEF, color: dark ? "#a78bfa" : "#7c3aed", onFill: () => { setFilledMEF(true); saveProgress({ filledMEF: true }); onMEF(); } },
                { key: "def", label: "Dental Examination Form",   desc: "Fill in your name and ID. The dentist completes the rest during examination.", filled: filledDEF, color: dark ? "#fb923c" : "#b45309", onFill: () => { setFilledDEF(true); saveProgress({ filledDEF: true }); onDEF(); } },
              ].map(({ key, label, desc, filled, color, onFill }) => (
                <div key={key} style={{ background: t.card, border: `1.5px solid ${filled ? t.green : t.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ color }}><IconFile color={color} /></div>
                    {filled && <span style={{ fontSize: 11, color: t.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck color={t.green} /> Filled</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.5, marginBottom: 12 }}>{desc}</div>
                  <button onClick={onFill} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${filled ? t.green : color}`, background: filled ? t.greenBg : t.card, color: filled ? t.green : color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {filled ? `✓ ${key.toUpperCase()} Filled — Fill again` : `Fill ${key.toUpperCase()} form →`}
                  </button>
                </div>
              ))}
                </div>
              </>
            )}
          </StepRow>

          {/* Step 3 — Collapsible Checklist */}
          <StepRow n={3} t={t} active={currentStep === 3} done={checklistDone} lineColor={checklistDone ? t.stepLineDone : t.stepLine} isLast={false}>
            <div style={{ fontSize: 15, fontWeight: 700, color: currentStep >= 3 ? t.text : t.textMuted, marginBottom: 4, paddingTop: 6 }}>Step 3 — Preparation Checklist</div>
            {currentStep < 3 ? (
              <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Fill both MEF and DEF forms first.
              </div>
            ) : (
            <><div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 10 }}>Complete all items before attending your appointments.</div>

            {/* Overall progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 6, background: t.cardBorder, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: checklistDone ? t.green : t.accent, width: `${Math.round((checked.length / allItems.length) * 100)}%`, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: checklistDone ? t.green : t.accent, whiteSpace: "nowrap" }}>
                {checked.length}/{allItems.length}
              </span>
            </div>

            {/* Collapsible sections */}
            {[
              { key: "phex", title: "For PHEx", color: t.blue, items: CHECKLIST_PHEX },
              { key: "dt",   title: "For Drug Test", color: t.teal, items: CHECKLIST_DT },
            ].map(({ key, title, color, items }) => {
              const sectionDone = items.filter(i => checked.includes(i.id)).length;
              const allSectionDone = sectionDone === items.length;
              const isOpen = expandedSections[key];
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  {/* Section header — clickable */}
                  <button onClick={() => setExpandedSections(s => ({ ...s, [key]: !s[key] }))}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1.5px solid ${allSectionDone ? t.green : t.cardBorder}`, borderRadius: isOpen ? "10px 10px 0 0" : 10, background: t.card, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.text, textAlign: "left" }}>{title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: allSectionDone ? t.green : color, background: allSectionDone ? t.greenBg : `${color}22`, padding: "2px 8px", borderRadius: 20 }}>
                      {allSectionDone ? "Completed" : `${sectionDone}/${items.length}`}
                    </span>
                  </button>

                  {/* Items — shown when expanded */}
                  {isOpen && (
                    <div style={{ border: `1.5px solid ${allSectionDone ? t.green : t.cardBorder}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {items.map((item, idx) => {
                        const isChecked = checked.includes(item.id);
                        return (
                          <button key={item.id} onClick={() => toggleCheck(item.id)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "none", borderTop: idx > 0 ? `1px solid ${t.divider}` : "none", background: isChecked ? t.greenBg : t.card, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 0.15s" }}>
                            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? t.green : t.cardBorder}`, background: isChecked ? t.green : t.card, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                              {isChecked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span style={{ fontSize: 13, color: isChecked ? t.green : t.text, fontWeight: isChecked ? 600 : 400, textDecoration: isChecked ? "line-through" : "none" }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {checklistDone && (
              <div style={{ background: t.greenBg, border: `1px solid ${t.green}44`, borderRadius: 10, padding: "10px 14px", marginTop: 8, fontSize: 12, color: t.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                All items checked — you're ready to attend!
              </div>
            )}
            </>)}
          </StepRow>

          {/* Step 4 — Attend */}
          <StepRow n={4} t={t} active={currentStep === 4} done={false} lineColor={t.stepLine} isLast={true}>
            <div style={{ fontSize: 15, fontWeight: 700, color: currentStep >= 4 ? t.text : t.textMuted, marginBottom: 4, paddingTop: 6 }}>Step 4 — Attend PHEx & Drug Test</div>
            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 4 }}>Attend both on your scheduled dates. Show your confirmation email at each station.</div>
            {currentStep < 4 ? (
              <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Complete all checklist items first.
              </div>
            ) : (
            <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bookedPHEx && (() => {
                const isPast = new Date(bookedPHEx.date + "T23:59:59") < new Date();
                const accent = isPast || phexCountdown === "Now!" ? t.orangeText : t.blueText;
                return (
                  <div style={{ fontSize: 12, color: t.text, fontWeight: 600, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <IconTimer color={accent} />
                    <span style={{ color: t.textSub, marginRight: 4 }}>PHEx:</span>
                    {formatBookingDate(bookedPHEx.date)} at {bookedPHEx.time}
                    {phexCountdown && <span style={{ color: accent }}>({phexCountdown} away)</span>}
                  </div>
                );
              })()}
              {bookedDT && (() => {
                const isPast = new Date(bookedDT.date + "T23:59:59") < new Date();
                const accent = isPast || dtCountdown === "Now!" ? t.orangeText : t.blueText;
                return (
                  <div style={{ fontSize: 12, color: t.text, fontWeight: 600, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <IconTimer color={accent} />
                    <span style={{ color: t.textSub, marginRight: 4 }}>Drug Test:</span>
                    {formatBookingDate(bookedDT.date)} at {bookedDT.time}
                    {dtCountdown && <span style={{ color: accent }}>({dtCountdown} away)</span>}
                  </div>
                );
              })()}
            </div>
            </>)}
          </StepRow>
        </div>

        {/* Results */}
        {(bookedPHEx || bookedDT) && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Results</div>
            <div style={{ background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, fontSize: 12, color: t.orangeText, lineHeight: 1.7 }}>
              Results are released by HSO staff after processing. Just wait and claim them on time.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div style={{ background: t.card, border: `1.5px solid ${t.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.blue, background: t.blueBg, padding: "3px 10px", borderRadius: 20, display: "inline-block", marginBottom: 10 }}>PHEx / X-Ray Results</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 8 }}>Available at <strong style={{ color: t.text }}>Waldo Perfecto Seminar Room</strong> — 10 days after procedure.</div>
                <div style={{ fontSize: 11, color: t.orangeText, fontWeight: 600, background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.orangeText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Unclaimed by Aug 31 will be forwarded to provider.
                </div>
              </div>
              <div style={{ background: t.card, border: `1.5px solid ${t.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, background: t.tealBg, padding: "3px 10px", borderRadius: 20, display: "inline-block", marginBottom: 10 }}>Drug Test Results</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, marginBottom: 8 }}>Available at <strong style={{ color: t.text }}>ERSC 2nd floor</strong> starting June 30.</div>
                <div style={{ fontSize: 11, color: t.textSub, fontWeight: 600, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  Bring your ID when claiming results.
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button onClick={onGuide} style={{ padding: "11px 20px", border: `1.5px solid ${t.cardBorder}`, borderRadius: 10, background: t.card, color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View booking guide →
          </button>
        </div>
      </div>
    </div>
  );
}