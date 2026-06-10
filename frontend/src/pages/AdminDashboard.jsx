import { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { getAuthHeader } from "../App";
import { useIsMobile } from "../utils/useIsMobile";

const TABS = ["Slots", "Venues", "Students"];
const MASTER_TABS = ["Slots", "Venues", "Students", "Users"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// ── Slots Tab ────────────────────────────────────────────────────────────────
function SlotsTab({ t, dark }) {
  const { show } = useModal();
  const [type, setType] = useState("phex");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [capacity, setCapacity] = useState(5);
  const [saving, setSaving] = useState(false);

    const DEFAULT_TIMES = [
    "8:00am","8:15am","8:30am","8:45am","9:00am","9:15am","9:30am","9:45am",
    "10:00am","10:15am","10:30am","10:45am","11:00am","11:15am","11:30am","11:45am",
    "1:00pm","1:15pm","1:30pm","1:45pm","2:00pm","2:15pm","2:30pm","2:45pm",
    "3:00pm","3:15pm","3:30pm","3:45pm","4:00pm","4:15pm","4:30pm","4:45pm",
    "5:00pm","5:15pm","5:30pm","5:45pm",
  ];

  const MNAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DNAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay    = (y, m) => new Date(y, m, 1).getDay();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hso/slots?type=${type}`, { headers: getAuthHeader() });
      if (r.ok) setSlots(await r.json());
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [type]);

  const getSlotForDate = (dateStr) => slots.find(s => s.date === dateStr);

  const handleCalendarClick = (dateStr, isSunday) => {
    if (isSunday) return;
    setNewDate(prev => prev === dateStr ? "" : dateStr);
  };

  const handleAdd = async () => {
    if (!newDate) { show({ type: "error", message: "Please select a date on the calendar." }); return; }
    setSaving(true);
    try {
      const slotsPayload = DEFAULT_TIMES.map(time => ({ time, capacity, booked: 0 }));
      const r = await fetch("/api/hso/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ appointmentType: type, date: newDate, slots: slotsPayload }),
      });
      if (r.ok) { show({ type: "success", message: "Slots added for " + formatDate(newDate) + "!" }); setNewDate(""); load(); }
      else { const d = await r.json(); show({ type: "error", message: d.error }); }
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  const handleDelete = async (date) => {
    if (!window.confirm("Delete all slots for " + formatDate(date) + "?")) return;
    try {
      await fetch("/api/hso/slots/" + type + "/" + date, { method: "DELETE", headers: getAuthHeader() });
      if (newDate === date) setNewDate("");
      load();
    } catch (_) {}
  };

  const accentColor = type === "phex" ? t.blue : t.teal;
  const accentBg    = type === "phex" ? t.blueBg : t.tealBg;
  const accentSolid = type === "phex" ? (dark ? "#2563eb" : "#1e3a8a") : (dark ? "#0d9488" : "#0f766e");

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDay(calYear, calMonth);
  const prevMonth   = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); };
  const nextMonth   = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); };

  const selectedDaySlot = newDate ? getSlotForDate(newDate) : null;

  return (
    <div>
      {/* Type switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["phex","dt"].map(t2 => (
          <button key={t2} onClick={() => { setType(t2); setNewDate(""); }}
            style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid " + (type === t2 ? t.accent : t.cardBorder), background: type === t2 ? t.accentBg : t.card, color: type === t2 ? t.accent : t.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t2 === "phex" ? "PHEx" : "Drug Test"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Calendar */}
        <div style={{ background: t.card, border: "1px solid " + t.cardBorder, borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSub, padding: "4px 8px", fontSize: 18, display: "flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{MNAMES[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSub, padding: "4px 8px", fontSize: 18, display: "flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {DNAMES.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: d === "SUN" ? "#ef4444" : t.textMuted, padding: "4px 0" }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={"e"+i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const isSunday = new Date(calYear, calMonth, d).getDay() === 0;
              const dateStr = calYear + "-" + String(calMonth+1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
              const existingSlot = getSlotForDate(dateStr);
              const isSelected = newDate === dateStr;
              const totalCap = existingSlot?.slots?.reduce((a, s) => a + s.capacity, 0) || 0;
              const totalBooked = existingSlot?.slots?.reduce((a, s) => a + s.booked, 0) || 0;
              const isFull = existingSlot && totalBooked >= totalCap;

              return (
                <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2px 0" }}>
                  <button
                    onClick={() => handleCalendarClick(dateStr, isSunday)}
                    disabled={isSunday}
                    title={existingSlot ? (totalBooked + "/" + totalCap + " booked") : (isSunday ? "Closed" : "Click to add slots")}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", border: "none",
                      cursor: isSunday ? "not-allowed" : "pointer",
                      background: isSelected ? accentSolid
                        : existingSlot ? (isFull ? "#fee2e2" : accentBg)
                        : "transparent",
                      color: isSelected ? "#fff"
                        : existingSlot ? (isFull ? "#ef4444" : accentColor)
                        : isSunday ? (dark ? "#374151" : "#d1d5db")
                        : t.text,
                      fontWeight: existingSlot || isSelected ? 700 : 400,
                      fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                      transition: "all 0.15s",
                    }}>
                    {d}
                    {existingSlot && !isSelected && (
                      <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isFull ? "#ef4444" : accentColor }} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textSub }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentBg, border: "1.5px solid " + accentColor }} />
              Has slots
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textSub }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fee2e2", border: "1.5px solid #ef4444" }} />
              Full
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textSub }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentSolid }} />
              Selected
            </div>
          </div>
        </div>

        {/* Action panel — shown when a date is selected */}
        {newDate && (
          <div style={{ background: t.card, border: "1.5px solid " + accentColor, borderRadius: 14, padding: "16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>{formatDate(newDate)}</div>
            {selectedDaySlot ? (
              <div>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>
                  {selectedDaySlot.slots?.length || 0} time slots · {selectedDaySlot.slots?.reduce((a,s)=>a+s.booked,0)||0}/{selectedDaySlot.slots?.reduce((a,s)=>a+s.capacity,0)||0} booked
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: t.bg, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: ((selectedDaySlot.slots?.reduce((a,s)=>a+s.booked,0)||0) / (selectedDaySlot.slots?.reduce((a,s)=>a+s.capacity,0)||1) * 100) + "%", height: "100%", background: accentColor, borderRadius: 3 }} />
                </div>
                <button onClick={() => handleDelete(newDate)}
                  style={{ width: "100%", padding: "9px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fee2e2", color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Delete all slots for this day
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>No slots yet. Set a capacity and add slots.</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>Capacity per time slot</label>
                  <input type="number" min="1" max="50" value={capacity} onChange={e => setCapacity(Number(e.target.value))}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid " + t.inputBorder, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: t.input, color: t.text, boxSizing: "border-box", outline: "none" }} />
                  <div style={{ fontSize: 11, color: t.textSub, marginTop: 4 }}>Will generate {DEFAULT_TIMES.length} slots (8am–12nn, 1pm–6pm) with {capacity} spots each.</div>
                </div>
                <button onClick={handleAdd} disabled={saving}
                  style={{ width: "100%", padding: "10px", border: "none", borderRadius: 8, background: accentSolid, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Adding…" : "Add " + DEFAULT_TIMES.length + " slots →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* No date selected hint */}
        {!newDate && !loading && (
          <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: "8px 0" }}>
            Click a date on the calendar to add or manage slots.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Venues Tab ───────────────────────────────────────────────────────────────
function VenuesTab({ t }) {
  const { show } = useModal();
  const [venues, setVenues] = useState({ phex_venue: "", phex_venue_sub: "", dt_venue: "", dt_venue_sub: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/hso/settings", { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : {})
      .then(data => setVenues(v => ({ ...v, ...data })))
      .catch(() => {});
  }, []);

  const save = async (key, value) => {
    setSaving(true);
    try {
      const r = await fetch("/api/hso/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ key, value }),
      });
      if (r.ok) show({ type: "success", message: "Venue updated!" });
      else show({ type: "error", message: "Failed to update." });
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: t.input, color: t.text, boxSizing: "border-box", outline: "none" };
  const lbl = { fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[
        { label: "PHEx Venue", mainKey: "phex_venue", subKey: "phex_venue_sub", mainPh: "e.g. Waldo Perfecto Seminar Room", subPh: "e.g. Ground floor, Br. Connon Hall" },
        { label: "Drug Test Venue", mainKey: "dt_venue", subKey: "dt_venue_sub", mainPh: "e.g. 2nd Floor, Enrique Razon Sports Center", subPh: "e.g. ERSC — across from the main gym" },
      ].map(({ label, mainKey, subKey, mainPh, subPh }) => (
        <div key={mainKey} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>{label}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Room / Building</label>
            <input style={inp} placeholder={mainPh} value={venues[mainKey] || ""} onChange={e => setVenues(v => ({ ...v, [mainKey]: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Floor / Description</label>
            <input style={inp} placeholder={subPh} value={venues[subKey] || ""} onChange={e => setVenues(v => ({ ...v, [subKey]: e.target.value }))} />
          </div>
          <button onClick={() => { save(mainKey, venues[mainKey]); save(subKey, venues[subKey]); }}
            disabled={saving}
            style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: t.accentBtn, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
            Save venue
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Students Tab ─────────────────────────────────────────────────────────────
function StudentsTab({ t, isMaster }) {
  const { show } = useModal();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    fetch("/api/hso/students", { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setStudents(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete account for ${name}? This will also delete all their appointments.`)) return;
    try {
      const r = await fetch(`/api/hso/students/${id}`, { method: "DELETE", headers: getAuthHeader() });
      const d = await r.json();
      if (!r.ok) show({ type: "error", message: d.error });
      else { show({ type: "success", message: `${name}'s account deleted.` }); load(); }
    } catch (_) { show({ type: "error", message: "Server error." }); }
  };

  const filtered = students.filter(s =>
    s.studentId?.includes(search) ||
    s.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    s.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stepLabel = (n) => ["", "Booking", "Forms", "Checklist 1", "Attend 1", "Checklist 2", "Attend 2", "Results"][n] || `Step ${n}`;

  return (
    <div>
      <input placeholder="Search by name, ID, or email…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "10px 14px", border: `1px solid ${t.inputBorder}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: t.input, color: t.text, boxSizing: "border-box", marginBottom: 14, outline: "none" }} />
      {loading ? (
        <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "20px 0" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "20px 0" }}>No students found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((s, i) => (
            <div key={i} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: 11, color: t.textSub }}>{s.studentId} · {s.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.currentStep >= 7 ? t.greenBg : t.blueBg, color: s.currentStep >= 7 ? t.green : t.blue }}>
                {stepLabel(s.currentStep || 1)}
              </span>
              {isMaster && (
                <button onClick={() => handleDelete(s._id, `${s.firstName} ${s.lastName}`)}
                  style={{ background: "none", border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "5px 10px", color: t.red || "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Users Tab (Master only) ───────────────────────────────────────────────────
function UsersTab({ t }) {
  const { show } = useModal();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "admin", password: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => {
    fetch("/api/hso/users", { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.firstName || !form.lastName || !form.password)
      { show({ type: "error", message: "All fields required." }); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/hso/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (r.ok) { show({ type: "success", message: "Account created!" }); setShowAdd(false); setForm({ email: "", firstName: "", lastName: "", role: "admin", password: "" }); load(); }
      else show({ type: "error", message: d.error });
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  const handleRoleChange = async (id, role) => {
    try {
      await fetch(`/api/hso/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ role }),
      });
      load();
    } catch (_) {}
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete account for ${name}?`)) return;
    try {
      const r = await fetch(`/api/hso/users/${id}`, { method: "DELETE", headers: getAuthHeader() });
      const d = await r.json();
      if (!r.ok) show({ type: "error", message: d.error });
      else load();
    } catch (_) {}
  };

  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: t.input, color: t.text, boxSizing: "border-box", outline: "none" };
  const lbl = { fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 };
  const roleColors = { master: t.blue, admin: t.teal, nurse: "#7c3aed" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: "7px 16px", border: "none", borderRadius: 8, background: t.accentBtn, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add account
        </button>
      </div>

      {showAdd && (
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>New HSO Account</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={lbl}>First name</label><input style={inp} value={form.firstName} onChange={e => set("firstName", e.target.value)} /></div>
            <div><label style={lbl}>Last name</label><input style={inp} value={form.lastName} onChange={e => set("lastName", e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={lbl}>Email</label><input style={inp} placeholder="email@dlsu.edu.ph" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div style={{ marginBottom: 10 }}><label style={lbl}>Password</label><input type="password" style={inp} value={form.password} onChange={e => set("password", e.target.value)} /></div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Role</label>
            <select style={{ ...inp }} value={form.role} onChange={e => set("role", e.target.value)}>
              <option value="admin">Admin</option>
              <option value="nurse">Nurse</option>
              <option value="master">Master</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "9px", border: `1px solid ${t.cardBorder}`, borderRadius: 8, background: t.card, color: t.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: t.accentBtn, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>{saving ? "Creating…" : "Create account"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "20px 0" }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "20px 0" }}>No HSO accounts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u, i) => (
            <div key={i} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{u.firstName} {u.lastName}</div>
                <div style={{ fontSize: 11, color: t.textSub }}>{u.email}</div>
              </div>
              <select value={u.role} onChange={e => handleRoleChange(u._id, e.target.value)}
                style={{ padding: "5px 10px", border: `1.5px solid ${roleColors[u.role] || t.cardBorder}`, borderRadius: 8, background: t.card, color: roleColors[u.role] || t.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                <option value="admin">Admin</option>
                <option value="nurse">Nurse</option>
                <option value="master">Master</option>
              </select>
              <button onClick={() => handleDelete(u._id, `${u.firstName} ${u.lastName}`)}
                style={{ background: "none", border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "6px 10px", color: t.red || "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard({ userData, onLogout, onBack }) {
  const { dark, toggle, t } = useTheme();
  const isMobile = useIsMobile();
  const isMaster = userData?.role === "master";
  const tabs = isMaster ? MASTER_TABS : TABS;
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: t.bg, minHeight: 0 }}>
      {/* NavBar */}
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>HSO Dashboard</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{isMaster ? "Master" : "Admin"} · {userData?.firstName} {userData?.lastName}</div>
        </div>
        <button onClick={toggle} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.divider}`, background: t.card, flexShrink: 0, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "12px 20px", border: "none", borderBottom: `2px solid ${activeTab === tab ? t.accent : "transparent"}`, background: "none", color: activeTab === tab ? t.accent : t.textSub, fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "28px 32px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {activeTab === "Slots"    && <SlotsTab t={t} dark={dark} />}
          {activeTab === "Venues"   && <VenuesTab t={t} />}
          {activeTab === "Students" && <StudentsTab t={t} isMaster={isMaster} />}
          {activeTab === "Users"    && isMaster && <UsersTab t={t} />}
        </div>
      </div>
    </div>
  );
}