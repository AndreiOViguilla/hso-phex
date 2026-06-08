import { useState, useEffect } from "react";
import { daysUntil } from "../utils/schedule";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Badge, Card, SectionLabel, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";

const IconLocation = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconCheck = ({ white = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={white ? "#fff" : "#16a34a"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconTimer = ({ color = "#1d4ed8" }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

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

function RescheduleModal({ type, bookingCode, onClose, onConfirm }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 360, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Change {type} Appointment</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
          Enter your personal booking code to verify and reschedule your appointment.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Booking code</label>
        <input
          placeholder="e.g. pikachu"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
        />
        {error && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => {
            if (!code.trim()) { setError("Please enter your booking code."); return; }
            if (code.trim() !== bookingCode) { setError("Incorrect booking code."); return; }
            onConfirm();
          }} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: "#1d4ed8", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Step row — circle + connecting line + content, all properly connected
function StepRow({ n, active, done, lineColor, isLast, children }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", minHeight: 0 }}>
      {/* Left: circle + line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 36 }}>
        {/* Circle */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: active ? "#1d4ed8" : done ? "#16a34a" : "#f3f4f6",
          border: `2px solid ${active ? "#1d4ed8" : done ? "#16a34a" : "#d1d5db"}`,
          color: active || done ? "#fff" : "#9ca3af",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, zIndex: 1, flexShrink: 0,
          boxShadow: active ? "0 0 0 4px rgba(29,78,216,0.15), 0 0 14px rgba(29,78,216,0.35)" : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
          transition: "all 0.3s ease",
        }}>
          {done ? <IconCheck white /> : n}
        </div>
        {/* Connecting line — stretches to fill remaining height */}
        {!isLast && (
          <div style={{
            width: 2,
            flex: 1,
            minHeight: 24,
            background: lineColor,
            marginTop: 4,
            transition: "background 0.3s",
          }} />
        )}
      </div>
      {/* Right: content */}
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

  const [bookedPHEx,    setBookedPHEx]    = useState(initPhex || null);
  const [bookedDT,      setBookedDT]      = useState(initDT   || null);
  const [filledMEF,     setFilledMEF]     = useState(false);
  const [filledDEF,     setFilledDEF]     = useState(false);
  const [rescheduleFor, setRescheduleFor] = useState(null);

  const phexPast = bookedPHEx ? new Date(bookedPHEx.date + "T23:59:59") < new Date() : false;
  const dtPast   = bookedDT   ? new Date(bookedDT.date   + "T23:59:59") < new Date() : false;

  const phexCountdown = useCountdown(bookedPHEx?.date, bookedPHEx?.time);
  const dtCountdown   = useCountdown(bookedDT?.date,   bookedDT?.time);

  const phexNow = phexCountdown === "Now!";
  const dtNow   = dtCountdown   === "Now!";

  const currentStep = (() => {
    // Go back to step 1 if either booking is missing, past, or time has come
    if (!bookedPHEx || !bookedDT || phexPast || dtPast || phexNow || dtNow) return 1;
    if (!filledMEF  || !filledDEF) return 2;
    return 3;
  })();

  let bookBadge;
  let bookingOpen = false;
  if (now < sched.bookStart) {
    const d = daysUntil(sched.bookStart);
    bookBadge = { label: `Opens in ${d} day${d !== 1 ? "s" : ""}`, type: "yellow" };
    bookingOpen = false;
  } else if (now <= sched.bookEnd) {
    bookBadge = { label: "Open now", type: "green" };
    bookingOpen = true;
  } else {
    bookBadge = { label: "Closed", type: "gray" };
    bookingOpen = false;
  }
  const d2 = daysUntil(sched.examStart);
  const examBadge = now < sched.examStart
    ? { label: `In ${d2} day${d2 !== 1 ? "s" : ""}`, type: "blue" }
    : { label: "Active", type: "green" };

  const BookedCard = ({ label, color, booking, countdown, onReschedule }) => {
    // State 1: Past — date has completely passed
    const isPast = new Date(booking.date + "T23:59:59") < new Date();
    // State 2: Now — countdown reached "Now!" (appointment time is here)
    const isNow  = countdown === "Now!";
    // State 3: Upcoming — has booking, not past, not now → normal green
    const isUpcoming = !isPast && !isNow;

    // Colors based on state
    const borderColor    = (isPast || isNow) ? "#f97316" : "#16a34a";
    const statusColor    = (isPast || isNow) ? "#f97316" : "#16a34a";
    const statusLabel    = (isPast || isNow) ? "Past" : "Booked";
    const countdownBg    = (isPast || isNow) ? "#fff7ed" : "#eff6ff";
    const countdownColor = (isPast || isNow) ? "#c2410c" : "#1d4ed8";
    const timerColor     = (isPast || isNow) ? "#c2410c" : "#1d4ed8";

    return (
      // No borderTop — removed the colored top stripe
      <div style={{ background: "#fff", border: `1.5px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ background: color === "#1d4ed8" ? "#eff6ff" : "#f0fdfa", color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{label}</span>
          {!isPast && !isNow && (
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              <IconCheck /> Booked
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          {formatBookingDate(booking.date)} at {booking.time}
        </div>

        {/* Countdown pill — only show if booked */}
        {countdown && (
          <div style={{ background: countdownBg, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: countdownColor, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center" }}>
            <IconTimer color={timerColor} />
            {isPast
              ? "Appointment passed"
              : isNow
              ? "Your appointment is already passed"
              : `${countdown} until appointment`}
          </div>
        )}

        {/* Past warning */}
        {isPast && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#c2410c", marginBottom: 10, lineHeight: 1.5 }}>
            This appointment date has passed. Please find another appointment.
          </div>
        )}

        {/* Now notice */}
        {isNow && !isPast && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#c2410c", marginBottom: 10, lineHeight: 1.5 }}>
            Your appointment time has already passed. Please find another appointment.
          </div>
        )}

        <button onClick={onReschedule} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px solid ${isPast ? "#f97316" : "#d1d5db"}`, background: isPast ? "#fff7ed" : "#fff", color: isPast ? "#c2410c" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Change appointment
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: t.bg }}>
      {/* NavBar */}
      <div style={{ background: "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Your Schedule</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>ID: {studentId}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Night mode toggle */}
          <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          {/* Profile */}
          <button onClick={onProfile} title="Edit profile" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          {/* Sign out */}
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>

      {rescheduleFor && (
        <RescheduleModal
          type={rescheduleFor === "phex" ? "PHEx" : "Drug Test"}
          bookingCode={rescheduleFor === "phex" ? bookedPHEx?.code : bookedDT?.code}
          onClose={() => setRescheduleFor(null)}
          onConfirm={() => {
            if (rescheduleFor === "phex") { setBookedPHEx(null); onBookPHEx(); }
            else { setBookedDT(null); onBookDT(); }
            setRescheduleFor(null);
          }}
        />
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "16px" : "32px 40px", width: "100%", boxSizing: "border-box" }}>

        {/* Booking + Exam period */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 28 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabel>Appointment booking</SectionLabel>
              <Badge {...bookBadge} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{sched.book}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.6 }}>
              Book PHEx and DT <strong>separately</strong>. Space at least 1 hour apart if doing both on the same day.
            </div>
          </Card>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabel>Exam period</SectionLabel>
              <Badge {...examBadge} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{sched.exam}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Each appointment is 15 minutes. Show your confirmation email to the guard at each station.
            </div>
          </Card>
        </div>

        {/* Vertical flowchart */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Step 1 */}
          <StepRow n={1} active={currentStep === 1} done={!!bookedPHEx && !!bookedDT && !phexPast && !dtPast && !phexNow && !dtNow} lineColor={bookedPHEx && bookedDT && !phexPast && !dtPast && !phexNow && !dtNow ? "#16a34a" : "#e5e7eb"} isLast={false}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, paddingTop: 6 }}>Step 1 — Book your appointments</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {bookedPHEx ? (
                <BookedCard label="PHEx" color="#1d4ed8" booking={bookedPHEx} countdown={phexCountdown} onReschedule={() => setRescheduleFor("phex")} />
              ) : (
                <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>PHEx</span></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>Periodic Health Examination</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><IconLocation /><div><div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Waldo Perfecto Seminar Room</div><div style={{ fontSize: 11, color: "#6b7280" }}>Ground floor, Br. Connon Hall</div></div></div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}><IconInfo /><div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Bring your MEF. Results claimed 10 days after procedure.</div></div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}><IconClock />Mon–Fri 8am–12nn, 1pm–6pm · Sat 8am–1pm</div>
                  <button onClick={bookingOpen ? onBookPHEx : undefined} disabled={!bookingOpen} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${bookingOpen ? "#1d4ed8" : "#d1d5db"}`, background: bookingOpen ? "#fff" : "#f9fafb", color: bookingOpen ? "#1d4ed8" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: bookingOpen ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{bookingOpen ? "Book PHEx appointment →" : "Booking not yet open"}</button>
                </div>
              )}
              {bookedDT ? (
                <BookedCard label="Drug Test" color="#0f766e" booking={bookedDT} countdown={dtCountdown} onReschedule={() => setRescheduleFor("dt")} />
              ) : (
                <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ background: "#f0fdfa", color: "#0f766e", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>Drug Test</span></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>Drug Testing (LFAD Program)</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><div><div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>2nd floor, Enrique Razon Sports Center</div><div style={{ fontSize: 11, color: "#6b7280" }}>ERSC — across from the main gym</div></div></div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}><IconInfo /><div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Mandatory under Section 1.20.3. Results available from June 30.</div></div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}><IconClock />Mon–Fri 8am–12nn, 1pm–6pm · Sat 8am–1pm</div>
                  <button onClick={bookingOpen ? onBookDT : undefined} disabled={!bookingOpen} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${bookingOpen ? "#0f766e" : "#d1d5db"}`, background: bookingOpen ? "#fff" : "#f9fafb", color: bookingOpen ? "#0f766e" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: bookingOpen ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{bookingOpen ? "Book Drug Test appointment →" : "Booking not yet open"}</button>
                </div>
              )}
            </div>
          </StepRow>

          {/* Step 2 */}
          <StepRow n={2} active={currentStep === 2} done={filledMEF && filledDEF} lineColor={filledMEF && filledDEF ? "#16a34a" : "#e5e7eb"} isLast={false}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8, paddingTop: 6 }}>Step 2 — Fill your forms</div>
            {bookedPHEx && bookedDT && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#0369a1", lineHeight: 1.7 }}>
                {(() => {
                  const phexPast = new Date(bookedPHEx.date + "T23:59:59") < new Date();
                  const dtPast   = new Date(bookedDT.date   + "T23:59:59") < new Date();
                  return (<>
                    <strong style={{ color: phexPast ? "#c2410c" : "#0369a1" }}>PHEx:</strong>{" "}
                    <span style={{ color: phexPast ? "#c2410c" : "#0369a1" }}>
                      {formatBookingDate(bookedPHEx.date)} at {bookedPHEx.time}
                      {phexCountdown && <span style={{ marginLeft: 6, fontWeight: 700 }}>({phexCountdown} away)</span>}
                    </span><br />
                    <strong style={{ color: dtPast ? "#c2410c" : "#0369a1" }}>Drug Test:</strong>{" "}
                    <span style={{ color: dtPast ? "#c2410c" : "#0369a1" }}>
                      {formatBookingDate(bookedDT.date)} at {bookedDT.time}
                      {dtCountdown && <span style={{ marginLeft: 6, fontWeight: 700 }}>({dtCountdown} away)</span>}
                    </span>
                  </>);
                })()}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#fff", border: `1.5px solid ${filledMEF ? "#16a34a" : "#e5e7eb"}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ color: "#7c3aed" }}><IconFile /></div>
                  {filledMEF && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck /> Filled</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Medical Examination Form</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>Fill in your student details, print, and bring to your PHEx appointment.</div>
                <button onClick={() => { setFilledMEF(true); onMEF(); }} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${filledMEF ? "#16a34a" : "#7c3aed"}`, background: filledMEF ? "#f0fdf4" : "#fff", color: filledMEF ? "#16a34a" : "#7c3aed", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {filledMEF ? "✓ MEF Filled — Fill again" : "Fill MEF form →"}
                </button>
              </div>
              <div style={{ background: "#fff", border: `1.5px solid ${filledDEF ? "#16a34a" : "#e5e7eb"}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ color: "#b45309" }}><IconFile /></div>
                  {filledDEF && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck /> Filled</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Dental Examination Form</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>Fill in your name and ID. The dentist completes the rest during examination.</div>
                <button onClick={() => { setFilledDEF(true); onDEF(); }} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid ${filledDEF ? "#16a34a" : "#b45309"}`, background: filledDEF ? "#f0fdf4" : "#fff", color: filledDEF ? "#16a34a" : "#b45309", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {filledDEF ? "✓ DEF Filled — Fill again" : "Fill DEF form →"}
                </button>
              </div>
            </div>
          </StepRow>

          {/* Step 3 — Attend (interchangeable) */}
          <StepRow n={3} active={currentStep === 3} done={false} lineColor="#e5e7eb" isLast={true}>
            <div style={{ fontSize: 15, fontWeight: 700, color: currentStep >= 3 ? "#111827" : "#9ca3af", marginBottom: 4, paddingTop: 6 }}>Step 3 — Attend PHEx & Drug Test</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 10 }}>
              Attend both on your scheduled dates. Order is interchangeable — show your confirmation email to the guard at each station.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bookedPHEx && (() => {
                const isPast    = new Date(bookedPHEx.date + "T23:59:59") < new Date();
                const isNowOrLate = isPast || phexCountdown === "Now!";
                const accentColor = isNowOrLate ? "#c2410c" : "#1d4ed8";
                return (
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <IconTimer color={accentColor} />
                    <span style={{ color: "#6b7280", marginRight: 4 }}>PHEx:</span>
                    {formatBookingDate(bookedPHEx.date)} at {bookedPHEx.time}
                    {phexCountdown && <span style={{ color: accentColor }}>({phexCountdown} away)</span>}
                  </div>
                );
              })()}
              {bookedDT && (() => {
                const isPast    = new Date(bookedDT.date + "T23:59:59") < new Date();
                const isNowOrLate = isPast || dtCountdown === "Now!";
                const accentColor = isNowOrLate ? "#c2410c" : "#1d4ed8";
                return (
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <IconTimer color={accentColor} />
                    <span style={{ color: "#6b7280", marginRight: 4 }}>Drug Test:</span>
                    {formatBookingDate(bookedDT.date)} at {bookedDT.time}
                    {dtCountdown && <span style={{ color: accentColor }}>({dtCountdown} away)</span>}
                  </div>
                );
              })()}
            </div>
          </StepRow>

        </div>

        {/* Results reminder */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px", marginTop: 20, marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
          <strong>X-ray results</strong> — available at Waldo Perfecto Seminar Room 10 days after procedure. Unclaimed by Aug 31 forwarded to provider.{" "}
          <strong>Drug test results</strong> — available at ERSC 2nd floor starting June 30.
        </div>

        <Btn variant="dark" onClick={onGuide}>View booking guide →</Btn>
      </div>
    </div>
  );
}