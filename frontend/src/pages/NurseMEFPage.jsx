import { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { useIsMobile } from "../utils/useIsMobile";

// ── Field name constants (must match PDF form field names exactly) ──────────

const STUDENT_TEXT_FIELDS = [
  "ID Number", "Date", "Last Name", "First Name", "MI", "Birthday",
  "Contact Number", "College Section", "Academic Year", "Emergency Name",
  "Relationship", "Emergency Contact", "Student Name Auth", "Student Age",
];

const CONSULT_FIELDS = [
  { key: "Blood Type",       label: "Blood Type" },
  { key: "Blood Pressure",   label: "Blood Pressure" },
  { key: "Resp Rate",        label: "Respiratory Rate" },
  { key: "Pulse Rate",       label: "Pulse Rate" },
  { key: "Temperature",      label: "Temperature" },
  { key: "Height Inches",    label: "Height (inches)" },
  { key: "Weight Pounds",    label: "Weight (lbs)" },
  { key: "BMI",              label: "BMI" },
  { key: "BMI Category",     label: "BMI Category" },
  { key: "LMP Female",       label: "LMP (Female only)" },
];

const HISTORY_FIELDS = [
  { key: "Medical History 1",   label: "Medical History 1" },
  { key: "Medical History 2",   label: "Medical History 2" },
  { key: "Medical History 3",   label: "Medical History 3" },
  { key: "Medical History 4",   label: "Medical History 4" },
  { key: "Present Medication 1", label: "Present Medication 1" },
  { key: "Present Medication 2", label: "Present Medication 2" },
];

const VISION_SOCIAL_FIELDS = [
  { key: "Left Vision",        label: "Left Eye Vision" },
  { key: "Right Vision",       label: "Right Eye Vision" },
  { key: "Smoking Details",    label: "Smoking Details" },
  { key: "Drinking Details",   label: "Drinking Details" },
  { key: "Exercising Details", label: "Exercising Details" },
  { key: "Type Of Disability", label: "Type of Disability" },
];

const DIAGNOSIS_FIELD = { key: "Diagnosis Impression", label: "Diagnosis / Impression" };

const FINDINGS_FIELDS = [
  { key: "EENT Findings",       label: "EENT", normalKey: "EENT Normal" },
  { key: "Head Neck Findings",  label: "Head & Neck", normalKey: "Head Neck Normal" },
  { key: "Breast Findings",     label: "Breast", normalKey: "Breast Normal" },
  { key: "Lungs Findings",      label: "Lungs", normalKey: "Lungs Normal" },
  { key: "Heart Findings",      label: "Heart", normalKey: "Heart Normal" },
  { key: "Skin Findings",       label: "Skin", normalKey: "Skin Normal" },
  { key: "Abdomen Findings",    label: "Abdomen", normalKey: "Abdomen Normal" },
  { key: "Neurologic Findings", label: "Neurologic", normalKey: "Neurologic Normal" },
  { key: "Chest Xray Findings", label: "Chest X-Ray", normalKey: "Chest Xray Normal" },
  { key: "Drug Test Findings",  label: "Drug Test", normalKey: "Drug Test Normal" },
];

const ASSESSMENT_TEXT_FIELDS = [
  { key: "Restrictions Details",        label: "Restrictions Details" },
  { key: "Clearance Specialty Reason",  label: "Clearance / Specialty Reason" },
  { key: "Examining Physician",         label: "Examining Physician" },
  { key: "Assigned Nurse",              label: "Assigned Nurse" },
  { key: "License Number",              label: "License Number" },
  { key: "Encoded By",                  label: "Encoded By" },
];

const ASSESSMENT_CHECKBOXES = [
  "Fit For Academic Activities",
  "Fit With Restrictions",
  "Pending Classification",
  "For Additional Xray",
  "For Clearance",
];

const SOCIAL_CHECKBOX_PAIRS = [
  { label: "Smoking",    yes: "Smoking Yes",    no: "Smoking No" },
  { label: "Drinking",   yes: "Drinking Yes",   no: "Drinking No" },
  { label: "Exercising", yes: "Exercising Yes", no: "Exercising No" },
];

const DISABILITY_CHECKBOX_PAIRS = [
  { label: "Disability",  yes: "Disability Yes", no: "Disability No" },
  { label: "PWD Card",    yes: "PWD Card Yes",   no: "PWD Card No" },
];

const LATERALITY_CHECKBOXES = ["Right Handed", "Left Handed", "Ambidextrous"];

// ── UI Helpers ────────────────────────────────────────────────────────────

function SectionCard({ title, children, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "16px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, t, multiline, readOnly }) {
  const style = {
    width: "100%", padding: "9px 12px", border: `1px solid ${readOnly ? t.cardBorder : t.inputBorder}`,
    borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    background: readOnly ? t.bg : t.input, color: readOnly ? t.textMuted : t.text,
    resize: multiline ? "vertical" : undefined, minHeight: multiline ? 60 : undefined,
  };
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
      {multiline ? (
        <textarea style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
      ) : (
        <input style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
      )}
    </div>
  );
}

function YesNoToggle({ label, yes, no, value, onChange, t }) {
  // value: "yes" | "no" | null
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }].map(({ v, l }) => (
          <button key={v} onClick={() => onChange(v)}
            style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${value === v ? t.accent : t.cardBorder}`, background: value === v ? t.accentBg : t.card, color: value === v ? t.accent : t.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function NormalAbnormalField({ label, normal, findings, onNormalChange, onFindingsChange, t }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.text, flex: 1 }}>{label}</span>
        <button onClick={() => onNormalChange(true)}
          style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${normal === true ? "#16a34a" : t.cardBorder}`, background: normal === true ? (t.greenBg || "#f0fdf4") : t.card, color: normal === true ? "#16a34a" : t.textSub, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Normal
        </button>
        <button onClick={() => onNormalChange(false)}
          style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${normal === false ? "#dc2626" : t.cardBorder}`, background: normal === false ? "#fef2f2" : t.card, color: normal === false ? "#dc2626" : t.textSub, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Abnormal
        </button>
      </div>
      {normal === false && (
        <textarea
          placeholder="Describe findings..."
          value={findings || ""}
          onChange={e => onFindingsChange(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: t.input, color: t.text, minHeight: 50, resize: "vertical" }}
        />
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function NurseMEFPage({ studentMongoId, onBack, onSaved }) {
  const { dark, toggle, t } = useTheme();
  const { show } = useModal();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentFields, setStudentFields] = useState({});
  const [form, setForm] = useState({});       // text fields (nurse-editable)
  const [checks, setChecks] = useState({});   // checkbox fields

  useEffect(() => {
    fetch(`/api/hso/students/${studentMongoId}/mef`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return; }
        setStudentInfo(data.student);
        const fd = data.formData || {};

        // Separate student text fields vs nurse fields/checkboxes
        const studentVals = {};
        STUDENT_TEXT_FIELDS.forEach(k => { studentVals[k] = fd[k] || ""; });
        setStudentFields(studentVals);

        const nurseVals = {};
        const allNurseKeys = [
          ...CONSULT_FIELDS.map(f => f.key),
          ...HISTORY_FIELDS.map(f => f.key),
          ...VISION_SOCIAL_FIELDS.map(f => f.key),
          DIAGNOSIS_FIELD.key,
          ...FINDINGS_FIELDS.map(f => f.key),
          ...ASSESSMENT_TEXT_FIELDS.map(f => f.key),
        ];
        allNurseKeys.forEach(k => { nurseVals[k] = fd[k] || ""; });
        setForm(nurseVals);

        const checkVals = {};
        const allCheckKeys = [
          "With Corrective Lens",
          ...SOCIAL_CHECKBOX_PAIRS.flatMap(p => [p.yes, p.no]),
          ...DISABILITY_CHECKBOX_PAIRS.flatMap(p => [p.yes, p.no]),
          ...LATERALITY_CHECKBOXES,
          ...FINDINGS_FIELDS.map(f => f.normalKey),
          ...ASSESSMENT_CHECKBOXES,
        ];
        allCheckKeys.forEach(k => { checkVals[k] = !!fd[k]; });
        setChecks(checkVals);

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentMongoId]);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCheck = (key, value) => setChecks(c => ({ ...c, [key]: value }));

  // Set a yes/no pair (e.g. Smoking Yes / Smoking No)
  const setPair = (yesKey, noKey, which) => {
    setChecks(c => ({ ...c, [yesKey]: which === "yes", [noKey]: which === "no" }));
  };
  const getPair = (yesKey, noKey) => checks[yesKey] ? "yes" : checks[noKey] ? "no" : null;

  // Set a normal/abnormal pair for findings
  const setNormal = (normalKey, findingsKey, isNormal) => {
    setChecks(c => ({ ...c, [normalKey]: isNormal }));
    if (isNormal) setField(findingsKey, "");
  };
  const getNormal = (normalKey) => checks[normalKey] === true ? true : checks[normalKey] === false ? false : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, ...checks };
      const r = await fetch(`/api/hso/students/${studentMongoId}/mef`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        show({ type: "success", message: "MEF saved and marked as filled." });
        if (onSaved) onSaved();
      } else {
        show({ type: "error", message: "Failed to save MEF." });
      }
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
      <div style={{ fontSize: 13, color: t.textMuted }}>Loading student record...</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: t.bg }}>
      {/* NavBar */}
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>MEF — Medical Examination</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{studentInfo?.firstName} {studentInfo?.lastName} · {studentInfo?.studentId}</div>
        </div>
        <button onClick={toggle} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "16px" : "24px 32px", width: "100%", boxSizing: "border-box" }}>

        {/* Student-filled info (read-only) */}
        <SectionCard title="Student Information (filled by student)" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {STUDENT_TEXT_FIELDS.map(key => (
              <TextInput key={key} label={key} value={studentFields[key]} t={t} readOnly />
            ))}
          </div>
        </SectionCard>

        {/* Consultation details */}
        <SectionCard title="Consultation Details (Vitals)" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {CONSULT_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        {/* Medical history / medications */}
        <SectionCard title="Medical History & Medications" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {HISTORY_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        {/* Vision */}
        <SectionCard title="Vision" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <TextInput label="Left Eye Vision" value={form["Left Vision"]} onChange={v => setField("Left Vision", v)} t={t} />
            <TextInput label="Right Eye Vision" value={form["Right Vision"]} onChange={v => setField("Right Vision", v)} t={t} />
          </div>
          <YesNoToggle label="With Corrective Lens" yes="With Corrective Lens" no="" value={checks["With Corrective Lens"] ? "yes" : "no"}
            onChange={v => setCheck("With Corrective Lens", v === "yes")} t={t} />
        </SectionCard>

        {/* Social history */}
        <SectionCard title="Social History" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            {SOCIAL_CHECKBOX_PAIRS.map(({ label, yes, no }) => (
              <YesNoToggle key={yes} label={label} yes={yes} no={no} value={getPair(yes, no)} onChange={v => setPair(yes, no, v)} t={t} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <TextInput label="Smoking Details" value={form["Smoking Details"]} onChange={v => setField("Smoking Details", v)} t={t} />
            <TextInput label="Drinking Details" value={form["Drinking Details"]} onChange={v => setField("Drinking Details", v)} t={t} />
            <TextInput label="Exercising Details" value={form["Exercising Details"]} onChange={v => setField("Exercising Details", v)} t={t} />
          </div>
        </SectionCard>

        {/* Disability / PWD / Laterality */}
        <SectionCard title="Disability, PWD & Laterality" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {DISABILITY_CHECKBOX_PAIRS.map(({ label, yes, no }) => (
              <YesNoToggle key={yes} label={label} yes={yes} no={no} value={getPair(yes, no)} onChange={v => setPair(yes, no, v)} t={t} />
            ))}
          </div>
          <TextInput label="Type of Disability" value={form["Type Of Disability"]} onChange={v => setField("Type Of Disability", v)} t={t} />
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>Hand Laterality</label>
            <div style={{ display: "flex", gap: 8 }}>
              {LATERALITY_CHECKBOXES.map(opt => (
                <button key={opt} onClick={() => {
                    const next = {};
                    LATERALITY_CHECKBOXES.forEach(o => next[o] = (o === opt));
                    setChecks(c => ({ ...c, ...next }));
                  }}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${checks[opt] ? t.accent : t.cardBorder}`, background: checks[opt] ? t.accentBg : t.card, color: checks[opt] ? t.accent : t.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Diagnosis */}
        <SectionCard title="Diagnosis" t={t}>
          <TextInput label={DIAGNOSIS_FIELD.label} value={form[DIAGNOSIS_FIELD.key]} onChange={v => setField(DIAGNOSIS_FIELD.key, v)} t={t} multiline />
        </SectionCard>

        {/* Physical findings */}
        <SectionCard title="Physical Examination Findings" t={t}>
          {FINDINGS_FIELDS.map(({ key, label, normalKey }) => (
            <NormalAbnormalField
              key={key}
              label={label}
              normal={getNormal(normalKey)}
              findings={form[key]}
              onNormalChange={(v) => setNormal(normalKey, key, v)}
              onFindingsChange={(v) => setField(key, v)}
              t={t}
            />
          ))}
        </SectionCard>

        {/* Assessment / sign-off */}
        <SectionCard title="Assessment & Sign-off" t={t}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 6 }}>Physician's Assessment</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ASSESSMENT_CHECKBOXES.map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[opt] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[opt] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[opt]} onChange={e => setCheck(opt, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {ASSESSMENT_TEXT_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)}
                t={t} multiline={key === "Restrictions Details" || key === "Clearance Specialty Reason"} />
            ))}
          </div>
        </SectionCard>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "14px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, marginBottom: 24 }}>
          {saving ? "Saving…" : "Save & Mark MEF as Filled"}
        </button>
      </div>
    </div>
  );
}
