import { useState, useEffect } from "react";
import { useModal } from "../components/Modal";
import { useTheme } from "../ThemeContext";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar } from "../components/UI";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function generateTimeLabels() {
  const slots = [];
  const add = (startH, endH) => {
    for (let h = startH; h < endH; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour   = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm   = h >= 12 ? "pm" : "am";
        const minute = m === 0 ? "00" : m;
        slots.push(`${hour}:${minute}${ampm}`);
      }
    }
  };
  add(8, 12);
  add(13, 18);
  return slots;
}

const TIME_LABELS = generateTimeLabels();

function getAvailableDates(bookStart, bookEnd) {
  const dates = [];
  const cur = new Date(bookStart);
  while (cur <= bookEnd) {
    const day = cur.getDay();
    if (day !== 0) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const ACTIVITIES = {
  phex: {
    label: "PHEx", title: "PHEX ID:125", org: "HSO PHEx Booking", duration: "15 min",
    venue: "Waldo Perfecto Seminar Room", color: "#1e3a8a",
    bookStart: new Date("2026-06-05"), bookEnd: new Date("2026-06-19"),
  },
  dt: {
    label: "Drug Test", title: "DRUG TEST ID:125", org: "HSO Drug Test Booking", duration: "15 min",
    venue: "2nd Floor, Enrique Razon Sports Center (ERSC)", color: "#0f766e",
    bookStart: new Date("2026-06-05"), bookEnd: new Date("2026-06-19"),
  },
};

function StepPicker({ activity, onSelect }) {
  const act = ACTIVITIES[activity];
  const { dark, t } = useTheme();

  const accentColor = activity === "dt" ? (dark ? t.tealText : act.color) : (dark ? t.blueText : act.color);
  const accentBg    = activity === "dt" ? (dark ? t.tealBg : t.blueBg) : (dark ? t.blueBg : t.blueBg);
  const accentSolid = activity === "dt" ? (dark ? "#0d9488" : act.color) : (dark ? "#2563eb" : act.color);

  const [calYear,    setCalYear]    = useState(act.bookStart.getFullYear());
  const [calMonth,   setCalMonth]   = useState(act.bookStart.getMonth());
  const [selected,   setSelected]   = useState(null);
  const [slots,      setSlots]      = useState([]);
  const [pickedSlot, setPickedSlot] = useState(null);
  const [daysData,   setDaysData]   = useState([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchDays = async () => {
      setDaysLoading(true);
      try {
        const resp = await fetch(`/api/appointments/days?type=${activity}`, {
          credentials: "include",
        });
        if (resp.ok) setDaysData(await resp.json());
      } catch (_) {}
      setDaysLoading(false);
    };
    fetchDays();
  }, [activity]);

  const fetchSlots = (date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const dayData = daysData.find(d => d.date === dateStr);
    if (dayData && dayData.slots) {
      setSlots(dayData.slots.map(s => ({ time: s.time, capacity: s.capacity, booked: s.booked, available: s.capacity - s.booked, full: s.booked >= s.capacity })));
    } else setSlots([]);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDayOfMonth(calYear, calMonth);

  const isTimePast = (timeStr) => {
    const [timePart, ampm] = [timeStr.slice(0, -2), timeStr.slice(-2)];
    let [h, m] = timePart.split(":").map(Number);
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
    return slotTime < new Date();
  };

  const isAvailable = (d) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayData = daysData.find(day => day.date === dateStr);
    if (!dayData) return false;
    const dateObj = new Date(calYear, calMonth, d);
    const isToday = dateObj.toDateString() === new Date().toDateString();
    return dayData.slots.some(s => {
      if (s.booked >= s.capacity) return false;
      if (isToday && isTimePast(s.time)) return false;
      return true;
    });
  };

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 0, height: isMobile ? "auto" : 580 }}>
      <div style={{ width: isMobile ? "100%" : 220, padding: "24px 20px", borderRight: isMobile ? "none" : `1px solid ${t.cardBorder}`, borderBottom: isMobile ? `1px solid ${t.cardBorder}` : "none", flexShrink: 0, background: dark ? "#263248" : "#fff" }}>
        <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{act.org}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: accentColor, marginBottom: 16 }}>{act.title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, fontSize: 13, color: t.text }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {act.duration}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: t.text }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {act.venue}
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 20px", borderRight: selected ? `1px solid ${t.cardBorder}` : "none", minWidth: 0, overflowY: "auto", background: dark ? "#1a2740" : "#fff" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 20 }}>Select a Date & Time</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSub, fontSize: 18, padding: "4px 8px" }}>&#8249;</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{MONTHS[calMonth]} {calYear}</span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSub, fontSize: 18, padding: "4px 8px" }}>&#8250;</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: t.textMuted, padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const date = new Date(calYear, calMonth, d);
            const avail = isAvailable(d);
            const isPast = date < new Date(new Date().setHours(0,0,0,0));
            const isToday = date.toDateString() === new Date().toDateString();
            const isPassedOrUsedUp = isPast || (isToday && !avail);
            const sel = selected && isSameDay(selected, date);
            const clickable = avail && !isPassedOrUsedUp;
            const dateStr2 = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const wasInDB = daysData.some(day => day.date === dateStr2);
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3px 0" }}>
                <button onClick={() => { if (clickable) { setSelected(date); setPickedSlot(null); fetchSlots(date); } }}
                  style={{ width: 36, height: 36, borderRadius: "50%", cursor: clickable ? "pointer" : "default",
                    background: sel ? accentSolid : (wasInDB && isPassedOrUsedUp) ? t.orangeBg : (avail && !isPassedOrUsedUp) ? accentBg : "transparent",
                    color: sel ? "#fff" : (wasInDB && isPassedOrUsedUp) ? "#f97316" : (avail && !isPassedOrUsedUp) ? accentColor : t.textMuted,
                    fontWeight: clickable ? 700 : 400, fontSize: 14, transition: "all 0.15s", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: isPassedOrUsedUp ? 0.5 : 1,
                    border: (wasInDB && isPassedOrUsedUp) ? "1.5px solid #fed7aa" : "none" }}>
                  {d}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 12, color: t.textSub }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Time zone: Philippine Time (GMT+8)
        </div>
      </div>

      {selected && (
        <div style={{ width: isMobile ? "100%" : 210, padding: "16px", overflowY: "auto", height: isMobile ? 260 : "100%", flexShrink: 0, borderLeft: isMobile ? "none" : `1px solid ${t.cardBorder}`, borderTop: isMobile ? `1px solid ${t.cardBorder}` : "none", background: dark ? "#1a2740" : "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            {DAYS[selected.getDay()]}, {MONTHS[selected.getMonth()].slice(0,3)} {selected.getDate()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((slot, i) => {
              const isPicked = pickedSlot?.time === slot.time;
              const isFull   = slot.full || slot.available <= 0;
              const isLow    = !isFull && slot.available <= 3;
              const isPastSlot = (() => {
                if (!selected) return false;
                const now = new Date();
                if (selected < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return true;
                if (selected.toDateString() === now.toDateString()) {
                  const [timePart, ampm] = [slot.time.slice(0,-2), slot.time.slice(-2)];
                  let [h, m] = timePart.split(":").map(Number);
                  if (ampm === "pm" && h !== 12) h += 12;
                  if (ampm === "am" && h === 12) h = 0;
                  const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
                  return slotTime < now;
                }
                return false;
              })();
              const isDisabled = isFull || isPastSlot;
              return (
                <button key={i} disabled={isDisabled}
                  onClick={() => { if (!isDisabled) { setPickedSlot(slot); onSelect(selected, slot); } }}
                  style={{ border: `1.5px solid ${isDisabled ? t.cardBorder : accentColor}`, borderRadius: 8, padding: "10px 8px",
                    background: isPicked ? accentSolid : dark ? "#1a2740" : "#fff",
                    color: isPicked ? "#fff" : isDisabled ? (dark ? "#4b5563" : "#c4c4c4") : accentColor,
                    cursor: isDisabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, textAlign: "center",
                    transition: "all 0.15s", opacity: isDisabled ? 0.5 : 1, position: "relative" }}>
                  <div>{slot.time}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, color: isDisabled ? (dark ? "#4b5563" : "#c4c4c4") : isLow ? "#ef4444" : isPicked ? "rgba(255,255,255,0.8)" : t.textMuted }}>
                    {isPastSlot ? "Passed" : isFull ? "Full" : isLow ? `Only ${slot.available} left!` : `${slot.available} spots left`}
                  </div>
                  {isDisabled && <div style={{ position: "absolute", inset: 0, borderRadius: 7, background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StepDetails({ activity, date, slot, onBack, onConfirm, prefillFirstName, prefillLastName, prefillEmail }) {
  const act = ACTIVITIES[activity];
  const { dark, t } = useTheme();
  const accentColor = activity === "dt" ? (dark ? t.tealText : act.color) : (dark ? t.blueText : act.color);
  const accentSolid = activity === "dt" ? (dark ? "#0d9488" : act.color) : (dark ? "#2563eb" : act.color);
  const [form, setForm] = useState({ firstName: prefillFirstName || "", lastName: prefillLastName || "", email: prefillEmail || "", code: "" });
  const { show } = useModal();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: t.input, color: t.text };
  const lbl = { fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 };
  const isMobile = useIsMobile();
  const dateStr = `${slot.time} \u2013 ${MONTHS[date.getMonth()].slice(0,3)} ${date.getDate()}, ${date.getFullYear()}`;

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email) { show({ type: "error", message: "Please fill in all required fields." }); return; }
    if (!form.email.endsWith("@dlsu.edu.ph")) { show({ type: "warning", title: "DLSU email required", message: "Please use your DLSU email address (@dlsu.edu.ph). You won't receive confirmation without it." }); return; }

    // 1-hour gap check
    try {
      const gapResp = await fetch("/api/appointments/mine", { credentials: "include" });
      if (gapResp.ok) {
        const existing = await gapResp.json();
        const otherType = activity === "phex" ? "dt" : "phex";
        const other = existing.find(b => b.appointmentType === otherType);
        const thisDateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
        if (other && other.appointmentDate === thisDateStr) {
          const parseTime = (tt) => { const [tp, ap] = [tt.slice(0,-2), tt.slice(-2)]; let [h,m] = tp.split(":").map(Number); if (ap==="pm"&&h!==12) h+=12; if (ap==="am"&&h===12) h=0; return h*60+m; };
          if (Math.abs(parseTime(slot.time) - parseTime(other.timeSlot)) < 60) {
            show({ type: "error", title: "1-hour gap required", message: `Your ${otherType === "dt" ? "Drug Test" : "PHEx"} appointment is at ${other.timeSlot}. Please pick a time at least 1 hour apart.` });
            return;
          }
        }
      }
    } catch (_) {}

    const bookDateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    try {
      const mineResp2 = await fetch("/api/appointments/mine", { credentials: "include" });
      if (mineResp2.ok) {
        const existing2 = await mineResp2.json();
        const ea = existing2.find(b => b.appointmentType === activity);
        if (ea) await fetch(`/api/appointments/${ea._id}`, { method: "DELETE", credentials: "include" });
      }
      const resp = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ appointmentType: activity, appointmentDate: bookDateStr, timeSlot: slot.time, bookingCode: form.code }),
      });
      const data = await resp.json();
      if (!resp.ok) { show({ type: "error", message: data.error || "Booking failed. Please try again." }); return; }
    } catch {
      show({ type: "error", message: "Could not connect to server." }); return;
    }
    onConfirm({ date: bookDateStr, time: slot.time, code: form.code });
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100%" }}>
      <div style={{ width: isMobile ? "100%" : 220, padding: "24px 20px", borderRight: isMobile ? "none" : `1px solid ${t.cardBorder}`, borderBottom: isMobile ? `1px solid ${t.cardBorder}` : "none", flexShrink: 0, background: dark ? "#263248" : "#fff" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: accentColor, fontSize: 20, padding: 0, marginBottom: 12 }}>&#8592;</button>
        <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{act.org}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: accentColor, marginBottom: 14 }}>{act.title}</div>
        {[{ icon: "clock", text: act.duration }, { icon: "pin", text: act.venue }, { icon: "cal", text: dateStr }, { icon: "globe", text: "Philippine Time" }].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, fontSize: 12, color: t.text }}>
            {icon === "clock" && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            {icon === "pin"   && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            {icon === "cal"   && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            {icon === "globe" && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
            <span>{text}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "24px 24px", overflowY: "auto", background: t.bg }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 20 }}>Enter Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><label style={lbl}>First Name <span style={{ color: "#ef4444" }}>*</span></label><input style={inp} value={form.firstName} onChange={e => set("firstName", e.target.value)} /></div>
          <div><label style={lbl}>Last Name <span style={{ color: "#ef4444" }}>*</span></label><input style={inp} value={form.lastName} onChange={e => set("lastName", e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>DLSU Email <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={inp} placeholder="yourname@dlsu.edu.ph" value={form.email} onChange={e => set("email", e.target.value)} />
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Must be your DLSU email or you won't receive confirmation.</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Personal booking code <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={inp} placeholder="e.g. pikachu" value={form.code} onChange={e => set("code", e.target.value)} />
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>Choose any word you'll remember. HSO uses this to cancel duplicate bookings.</div>
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>By proceeding, you confirm that you have read and agree to the booking terms.</div>
        <button onClick={handleSubmit} style={{ background: accentSolid, color: "#fff", border: "none", borderRadius: 24, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Schedule Event
        </button>
      </div>
    </div>
  );
}

function StepConfirmed({ activity, booking, onDone }) {
  const act = ACTIVITIES[activity];
  const { dark, t } = useTheme();
  const accentColor = activity === "dt" ? (dark ? t.tealText : act.color) : (dark ? t.blueText : act.color);
  const accentSolid = activity === "dt" ? (dark ? "#0d9488" : act.color) : (dark ? "#2563eb" : act.color);
  const d = new Date(booking.date + "T00:00:00");
  const dateStr = `${booking.time} \u2013 ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  // Build Google Calendar URL
  const buildGCalUrl = () => {
    const parseMin = (t) => {
      const [tp, ap] = [t.slice(0,-2), t.slice(-2)];
      let [h, m] = tp.split(":").map(Number);
      if (ap === "pm" && h !== 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      return { h, m };
    };
    const { h, m } = parseMin(booking.time);
    const pad = (n) => String(n).padStart(2, "0");
    const startDt = `${booking.date.replace(/-/g,"")}T${pad(h)}${pad(m)}00`;
    const endDt   = `${booking.date.replace(/-/g,"")}T${pad(h+1)}${pad(m)}00`;
    const title    = encodeURIComponent(`${act.label} Appointment \u2014 DLSU HSO`);
    const details  = encodeURIComponent(`Your ${act.label} appointment at ${act.venue}. Show your confirmation email to the guard.`);
    const location = encodeURIComponent(act.venue);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&details=${details}&location=${location}&ctz=Asia/Manila`;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", background: t.bg }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: t.greenBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 8 }}>You are scheduled!</div>
      <div style={{ fontSize: 14, color: t.textSub, marginBottom: 24 }}>A calendar invitation has been sent to your email address.</div>

      <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "20px 24px", maxWidth: 340, width: "100%", textAlign: "left", marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: accentColor, marginBottom: 12 }}>{act.title}</div>
        {[act.org, dateStr, "Philippine Time", act.venue].map((label, i) => (
          <div key={i} style={{ fontSize: 13, color: t.text, marginBottom: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.textMuted, marginTop: 5, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <div style={{ background: t.blueBg, border: `1px solid ${t.blue}44`, borderRadius: 10, padding: "12px 16px", maxWidth: 340, width: "100%", fontSize: 12, color: t.blueText, marginBottom: 24, textAlign: "left" }}>
        Show this confirmation email to the guard at the {act.label} station on your appointment day.
      </div>

      {/* Add to Google Calendar */}
      <a href={buildGCalUrl()} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", maxWidth: 300, padding: "12px", background: t.card, border: `1.5px solid ${t.cardBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: t.text, textDecoration: "none", marginBottom: 12, boxSizing: "border-box" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Add to Google Calendar
      </a>

      <button onClick={onDone} style={{ background: accentSolid, color: "#fff", border: "none", borderRadius: 10, padding: "13px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", maxWidth: 300, width: "100%" }}>
        Back to Schedule
      </button>
    </div>
  );
}

export default function BookingPage({ activity = "phex", studentId, prefillFirstName, prefillLastName, prefillEmail, onBack, onBooked }) {
  const { dark, toggle, t } = useTheme();
  const [step,    setStep]    = useState("pick");
  const [date,    setDate]    = useState(null);
  const [slot,    setSlot]    = useState(null);
  const [booking, setBooking] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authValid,   setAuthValid]   = useState(false);
  const act = ACTIVITIES[activity];

  useEffect(() => {
    const verify = async () => {
      try {
        const resp = await fetch("/api/students/me", { credentials: "include" });
        if (resp.ok) setAuthValid(true);
        else setAuthValid(false);
      } catch { setAuthValid(false); }
      setAuthChecked(true);
    };
    verify();
  }, []);

  if (!authChecked) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t?.textMuted || "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
      <div style={{ fontSize: 13, color: t.textMuted }}>Verifying session...</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!authValid) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: t.redBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Access denied</div>
      <div style={{ fontSize: 13, color: t.textSub, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>You must be signed in with a valid session to book an appointment. Please sign in and try again.</div>
      <button onClick={onBack} style={{ background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Go back</button>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: t.bg }}>
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <button onClick={step === "details" ? () => setStep("pick") : onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>&#8592;</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Book {act.label} Appointment</div>
          {studentId && <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {studentId}</div>}
        </div>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: t.card, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto" }}>
          {step === "pick"      && <StepPicker activity={activity} onSelect={(d, s) => { setDate(d); setSlot(s); setStep("details"); }} />}
          {step === "details"   && <StepDetails activity={activity} date={date} slot={slot} onBack={() => setStep("pick")} onConfirm={(b) => { setBooking(b); setStep("confirmed"); }} prefillFirstName={prefillFirstName} prefillLastName={prefillLastName} prefillEmail={prefillEmail} />}
          {step === "confirmed" && <StepConfirmed activity={activity} booking={booking} onDone={() => { if (onBooked) onBooked(booking); else onBack(); }} />}
        </div>
      </div>
    </div>
  );
}