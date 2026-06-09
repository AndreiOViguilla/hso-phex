import { useState, useEffect } from "react";
import { getAuthHeader } from "../App";
import { useModal } from "../components/Modal";
import { useTheme } from "../ThemeContext";

const COLLEGES = [
  "College of Business and Economics (CBE)",
  "College of Computer Studies (CCS)",
  "College of Education (CED)",
  "College of Engineering (COE)",
  "College of Law (CL)",
  "College of Liberal Arts (CLA)",
  "College of Music (CM)",
  "College of Nursing (CN)",
  "College of Philosophy (CP)",
  "College of Science (CS)",
  "College of Tourism and Hospitality Management (CTHM)",
  "Br. Andrew Gonzalez FSC College of Education (BAGCED)",
];

export default function ProfilePage({ userData, onBack, onSaved }) {
  const { dark, toggle, t } = useTheme();
  const { show } = useModal();

  const [form, setForm] = useState({
    firstName:     userData?.firstName     || "",
    middleInitial: userData?.middleInitial || "",
    lastName:      userData?.lastName      || "",
    gender:        userData?.gender        || "",
    college:       userData?.college       || "",
    course:        userData?.course        || "",
    birthday:      userData?.birthday      || "",
    contact:       userData?.contact       || "",
  });

  // Fetch fresh data from backend on mount — override any stale props
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/students/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) return;
        setForm({
          firstName:     user.firstName     || "",
          middleInitial: user.middleInitial || "",
          lastName:      user.lastName      || "",
          gender:        user.gender        || "",
          college:       user.college       || "",
          course:        user.course        || "",
          birthday:      user.birthday      || "",
          contact:       user.contact       || "",
        });
      })
      .catch(() => {});
  }, []);



  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = {
  width: "100%", padding: "10px 12px",
  border: `1.5px solid ${t.inputBorder}`,
  borderRadius: 8, fontSize: 14,
  fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
  background: t.input, color: t.text,
  colorScheme: dark ? "dark" : "light",   // ← add this
};

  const lbl = {
    fontSize: 12, fontWeight: 600,
    color: t.textSub, display: "block", marginBottom: 5,
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) { show({ type: "error", message: "First and last name are required." }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/students/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) { show({ type: "error", message: data.error || "Failed to save profile." }); setLoading(false); return; }
      show({ type: "success", title: "Profile saved!", message: "Your profile has been updated successfully." });
      onSaved(data);
    } catch { show({ type: "error", message: "Could not connect to server. Please try again." }); }
    setLoading(false);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: t.bg }}>
      {/* NavBar */}
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Edit Profile</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>ID: {userData?.studentId} · {userData?.email}</div>
        </div>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>

        {/* Student ID — read only */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>STUDENT ID (not editable)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{userData?.studentId}</div>
          </div>
        </div>

        {/* Name */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Name</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12, marginBottom: 12 }}>
            <div><label style={lbl}>First Name</label><input style={inp} value={form.firstName} onChange={e => set("firstName", e.target.value)} /></div>
            <div><label style={lbl}>Last Name</label><input style={inp} value={form.lastName} onChange={e => set("lastName", e.target.value)} /></div>
            <div><label style={lbl}>M.I.</label><input style={inp} value={form.middleInitial} maxLength={3} onChange={e => set("middleInitial", e.target.value)} /></div>
          </div>
          <div>
            <label style={lbl}>Gender</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["Female", "Male"].map(g => (
                <label key={g} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: t.text, flex: 1, padding: "10px 14px", border: `1.5px solid ${form.gender === g ? t.accent : t.inputBorder}`, borderRadius: 8, background: form.gender === g ? t.accentBg : t.input, transition: "all 0.15s" }}>
                  <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set("gender", g)} style={{ accentColor: "#1d4ed8" }} />{g}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Academic info */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Academic Information</div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>College</label>
            <select style={{ ...inp, cursor: "pointer" }} value={form.college} onChange={e => set("college", e.target.value)}>
              <option value="">Select college…</option>
              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Course / Program</label>
            <input style={inp} placeholder="e.g. BS Computer Science" value={form.course} onChange={e => set("course", e.target.value)} />
          </div>
        </div>

        {/* Personal info */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Personal Information</div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Birthday</label>
            <input style={inp} type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Contact Number</label>
            <input style={inp} placeholder="e.g. 09171234567" value={form.contact} onChange={e => set("contact", e.target.value)} />
          </div>
        </div>


        <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "13px", background: loading ? (dark ? "#1e3a5f" : "#93c5fd") : t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}