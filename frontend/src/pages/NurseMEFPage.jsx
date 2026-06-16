import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { useIsMobile } from "../utils/useIsMobile";
import { MEF_PDF_FIELDS, MEF_PDF_WIDTH, MEF_PDF_HEIGHT } from "../utils/mefPdfFields";

// ── Field lists ───────────────────────────────────────────────────────────────
const STUDENT_FIELDS = new Set([
  "ID Number","Date","Last Name","First Name","MI","Birthday",
  "Contact Number","College Section","Academic Year","Emergency Name",
  "Relationship","Emergency Contact","Student Name Auth","Student Age",
  "Gender Female","Gender Male",
]);

const CONSULT_FIELDS = [
  { key: "Blood Type", label: "Blood Type" },
  { key: "Blood Pressure", label: "Blood Pressure" },
  { key: "Resp Rate", label: "Respiratory Rate" },
  { key: "Pulse Rate", label: "Pulse Rate" },
  { key: "Temperature", label: "Temperature" },
  { key: "Height Inches", label: "Height (inches)" },
  { key: "Weight Pounds", label: "Weight (lbs)" },
  { key: "BMI", label: "BMI" },
  { key: "BMI Category", label: "BMI Category" },
  { key: "LMP Female", label: "LMP (Female only)" },
];
const HISTORY_FIELDS = [
  { key: "Medical History 1", label: "Medical History 1" },
  { key: "Medical History 2", label: "Medical History 2" },
  { key: "Medical History 3", label: "Medical History 3" },
  { key: "Medical History 4", label: "Medical History 4" },
  { key: "Present Medication 1", label: "Present Medication 1" },
  { key: "Present Medication 2", label: "Present Medication 2" },
];
const FINDINGS_FIELDS = [
  { key: "EENT Findings", label: "EENT", normalKey: "EENT Normal" },
  { key: "Head Neck Findings", label: "Head & Neck", normalKey: "Head Neck Normal" },
  { key: "Breast Findings", label: "Breast", normalKey: "Breast Normal" },
  { key: "Lungs Findings", label: "Lungs", normalKey: "Lungs Normal" },
  { key: "Heart Findings", label: "Heart", normalKey: "Heart Normal" },
  { key: "Skin Findings", label: "Skin", normalKey: "Skin Normal" },
  { key: "Abdomen Findings", label: "Abdomen", normalKey: "Abdomen" },
  { key: "Neurologic Findings", label: "Neurologic", normalKey: "Neurologic Normal" },
  { key: "Chest Xray Findings", label: "Chest X-Ray", normalKey: "Chest Xray Normal" },
  { key: "Drug Test Findings", label: "Drug Test", normalKey: "Drug Test Normal" },
];
const ASSESSMENT_TEXT_FIELDS = [
  { key: "Restrictions Details", label: "Restrictions Details" },
  { key: "Clearance Specialty Reason", label: "Clearance / Specialty Reason" },
  { key: "Examining Physician", label: "Examining Physician" },
  { key: "Assigned Nurse", label: "Assigned Nurse" },
  { key: "License Number", label: "License Number" },
  { key: "Encoded By", label: "Encoded By" },
];
const ASSESSMENT_CHECKBOXES = [
  "Fit For Academic Activities","Fit With Restrictions","Pending Classification",
  "For Additional Xray","For Clearance",
];
const SOCIAL_CHECKBOX_PAIRS = [
  { label: "Smoking", yes: "Smoking Yes", no: "Smoking No" },
  { label: "Drinking", yes: "Drinking Yes", no: "Drinking No" },
  { label: "Exercising", yes: "Exercising Yes", no: "Exercising No" },
];
const DISABILITY_CHECKBOX_PAIRS = [
  { label: "Disability", yes: "Disability Yes", no: "Disability No" },
  { label: "PWD Card", yes: "With PWD card Yes", no: "With PWD card No" },
];
const LATERALITY_CHECKBOXES = ["Right Handed", "Left handed", "Ambidextrous"];

const ALL_TEXT_KEYS = [
  ...CONSULT_FIELDS.map(f=>f.key), ...HISTORY_FIELDS.map(f=>f.key),
  ...FINDINGS_FIELDS.map(f=>f.key), ...ASSESSMENT_TEXT_FIELDS.map(f=>f.key),
  "Left Vision","Right Vision","Smoking Details","Drinking Details",
  "Exercising Details","Type of disability","Diagnosis Impression",
];
const ALL_CHECK_KEYS = [
  "With Corrective Lens",
  ...SOCIAL_CHECKBOX_PAIRS.flatMap(p=>[p.yes,p.no]),
  ...DISABILITY_CHECKBOX_PAIRS.flatMap(p=>[p.yes,p.no]),
  ...LATERALITY_CHECKBOXES,
  ...FINDINGS_FIELDS.map(f=>f.normalKey),
  ...ASSESSMENT_CHECKBOXES,
];

// Fields the nurse can interact with (not student-filled)
const NURSE_TEXT_FIELDS = MEF_PDF_FIELDS.filter(f => f.type === "text" && !STUDENT_FIELDS.has(f.name));
const NURSE_CHECK_FIELDS = MEF_PDF_FIELDS.filter(f => f.type === "checkbox" && !STUDENT_FIELDS.has(f.name));
const STUDENT_TEXT_FIELDS_OVERLAY = MEF_PDF_FIELDS.filter(f => f.type === "text" && STUDENT_FIELDS.has(f.name));
const STUDENT_CHECK_FIELDS_OVERLAY = MEF_PDF_FIELDS.filter(f => f.type === "checkbox" && STUDENT_FIELDS.has(f.name));

// ── UI Helpers ────────────────────────────────────────────────────────────────
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
      {multiline
        ? <textarea style={style} value={value||""} onChange={e=>onChange?.(e.target.value)} readOnly={readOnly}/>
        : <input style={style} value={value||""} onChange={e=>onChange?.(e.target.value)} readOnly={readOnly}/>}
    </div>
  );
}
function YesNoToggle({ label, value, onChange, t }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{v:"yes",l:"Yes"},{v:"no",l:"No"}].map(({v,l}) => (
          <button key={v} onClick={() => onChange(v)}
            style={{ flex:1, padding:"8px", borderRadius:8, border:`1.5px solid ${value===v?t.accent:t.cardBorder}`, background:value===v?t.accentBg:t.card, color:value===v?t.accent:t.textSub, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
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
          style={{ padding:"5px 12px", borderRadius:8, border:`1.5px solid ${normal===true?"#16a34a":t.cardBorder}`, background:normal===true?"#f0fdf4":t.card, color:normal===true?"#16a34a":t.textSub, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          Normal
        </button>
        <button onClick={() => onNormalChange(false)}
          style={{ padding:"5px 12px", borderRadius:8, border:`1.5px solid ${normal===false?"#dc2626":t.cardBorder}`, background:normal===false?"#fef2f2":t.card, color:normal===false?"#dc2626":t.textSub, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          Abnormal
        </button>
      </div>
      {normal === false && (
        <textarea placeholder="Describe findings..." value={findings||""} onChange={e=>onFindingsChange(e.target.value)}
          style={{ width:"100%", padding:"8px 12px", border:`1px solid ${t.inputBorder}`, borderRadius:8, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:t.input, color:t.text, minHeight:50, resize:"vertical" }}/>
      )}
    </div>
  );
}

// ── PDF Field Overlay ─────────────────────────────────────────────────────────
function PdfFieldOverlay({ form, checks, studentFields, onFormChange, onCheckChange, fitScale }) {
  const allValues = { ...studentFields, ...form };

  const renderCheck = (f, isNurse) => (
    <div key={f.name}
      onClick={isNurse ? () => onCheckChange(f.name, !checks[f.name]) : undefined}
      style={{
        position: "absolute",
        left: f.x * fitScale, top: f.y * fitScale,
        width: f.w * fitScale, height: f.h * fitScale,
        cursor: isNurse ? "pointer" : "default",
        pointerEvents: isNurse ? "auto" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {(isNurse ? checks[f.name] : studentFields[f.name]) && (
        <div style={{
          width: f.w * fitScale * 0.6,
          height: f.h * fitScale * 0.32,
          borderLeft: `${Math.max(1.2, f.w * fitScale * 0.18)}px solid #111`,
          borderBottom: `${Math.max(1.2, f.w * fitScale * 0.18)}px solid #111`,
          transform: "rotate(-45deg)",
          marginTop: `-${f.h * fitScale * 0.08}px`,
        }} />
      )}
    </div>
  );

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {/* Student text fields — read-only display */}
      {STUDENT_TEXT_FIELDS_OVERLAY.map(f => (
        <div key={f.name} style={{
          position: "absolute",
          left: f.x * fitScale, top: f.y * fitScale,
          width: f.w * fitScale, height: f.h * fitScale,
          fontSize: Math.max(5, Math.min(f.h * fitScale * 0.75, 10)),
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#111", display: "flex", alignItems: "center",
          overflow: "hidden", pointerEvents: "none",
        }}>{allValues[f.name] || ""}</div>
      ))}

      {/* Student checkboxes — display only */}
      {STUDENT_CHECK_FIELDS_OVERLAY.map(f => renderCheck(f, false))}

      {/* Nurse text fields — editable */}
      {NURSE_TEXT_FIELDS.map(f => (
        <input key={f.name} value={form[f.name] || ""}
          onChange={e => onFormChange(f.name, e.target.value)}
          style={{
            position: "absolute",
            left: f.x * fitScale, top: f.y * fitScale,
            width: f.w * fitScale, height: f.h * fitScale,
            fontSize: Math.max(5, Math.min(f.h * fitScale * 0.75, 10)),
            fontFamily: "Helvetica, Arial, sans-serif",
            border: "none", outline: "none",
            background: "rgba(255,255,240,0.85)",
            color: "#111", padding: "0 2px",
            boxSizing: "border-box", pointerEvents: "auto",
          }}
        />
      ))}

      {/* Nurse checkboxes — clickable */}
      {NURSE_CHECK_FIELDS.map(f => renderCheck(f, true))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NurseMEFPage({ studentMongoId, onBack, onSaved }) {
  const { t } = useTheme();
  const { show } = useModal();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentFields, setStudentFields] = useState({});
  const [form, setForm] = useState({});
  const [checks, setChecks] = useState({});
  const [zoom, setZoom] = useState(1.0);
  const [fitScale, setFitScale] = useState(1.0);
  const [fitWidth, setFitWidth] = useState(0);
  const [fitHeight, setFitHeight] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef(null);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const panelW = (container.clientWidth || 700) - 24;
    const fw = Math.max(panelW, 280) * zoom;
    const fs = fw / MEF_PDF_WIDTH;
    setFitScale(fs);
    setFitWidth(fw);
    setFitHeight(MEF_PDF_HEIGHT * fs);
  }, [zoom]);

  useEffect(() => { updateScale(); }, [zoom, imgLoaded, updateScale]);
  useEffect(() => {
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useEffect(() => {
    fetch(`/api/hso/students/${studentMongoId}/mef`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return; }
        setStudentInfo(data.student);
        const fd = data.formData || {};

        const sv = {};
        ["ID Number","Date","Last Name","First Name","MI","Birthday","Contact Number",
         "College Section","Academic Year","Emergency Name","Relationship","Emergency Contact",
         "Student Name Auth","Student Age","Gender Female","Gender Male"]
          .forEach(k => { sv[k] = fd[k] || ""; });
        setStudentFields(sv);

        const fv = {};
        ALL_TEXT_KEYS.forEach(k => { fv[k] = fd[k] || ""; });
        setForm(fv);

        const cv = {};
        ALL_CHECK_KEYS.forEach(k => { cv[k] = !!fd[k]; });
        setChecks(cv);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentMongoId]);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCheck = useCallback((key, value) => setChecks(c => ({ ...c, [key]: value })), []);
  const setPair = (yesKey, noKey, which) => setChecks(c => ({ ...c, [yesKey]: which==="yes", [noKey]: which==="no" }));
  const getPair = (yesKey, noKey) => checks[yesKey] ? "yes" : checks[noKey] ? "no" : null;
  const setNormal = (normalKey, findingsKey, isNormal) => {
    setChecks(c => ({ ...c, [normalKey]: isNormal }));
    if (isNormal) setField(findingsKey, "");
  };
  const getNormal = (normalKey) => checks[normalKey] === true ? true : checks[normalKey] === false ? false : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/hso/students/${studentMongoId}/mef`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, ...checks }),
      });
      if (r.ok) { show({ type: "success", message: "MEF saved." }); if (onSaved) onSaved(); }
      else show({ type: "error", message: "Failed to save MEF." });
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const resp = await fetch(`/api/hso/students/${studentMongoId}/mef/pdf/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, ...checks }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error || "Failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `MEF_${studentFields["ID Number"] || studentInfo?.studentId || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { show({ type: "error", title: "Download failed", message: e.message }); }
    setDownloading(false);
  };

  if (loading) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation:"spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
      <div style={{ fontSize:13, color:t.textMuted }}>Loading student record...</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", background:t.bg }}>
      {/* Header */}
      <div style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0, borderBottom:`1px solid ${t.divider}`, background:t.card }}>
        <button onClick={onBack} style={{ background:t.bg, border:`1px solid ${t.cardBorder}`, color:t.text, width:32, height:32, borderRadius:8, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
        <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{studentInfo?.firstName} {studentInfo?.lastName}</div>
        <div style={{ fontSize:12, color:t.textSub }}>· {studentInfo?.studentId}</div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:isMobile?"column":"row", minHeight:0, overflow:"hidden" }}>

        {/* Left panel */}
        <div style={{ flex:isMobile?"none":"0 0 50%", minWidth:isMobile?"none":380, maxWidth:isMobile?"none":620, borderRight:isMobile?"none":`1px solid ${t.divider}`, overflowY:"auto", padding:isMobile?"16px":"24px 32px", boxSizing:"border-box" }}>

          <SectionCard title="Consultation Details (Vitals)" t={t}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:10 }}>
              {CONSULT_FIELDS.map(({key,label}) => <TextInput key={key} label={label} value={form[key]} onChange={v=>setField(key,v)} t={t}/>)}
            </div>
          </SectionCard>

          <SectionCard title="Medical History & Medications" t={t}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              {HISTORY_FIELDS.map(({key,label}) => <TextInput key={key} label={label} value={form[key]} onChange={v=>setField(key,v)} t={t}/>)}
            </div>
          </SectionCard>

          <SectionCard title="Vision" t={t}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <TextInput label="Left Eye Vision" value={form["Left Vision"]} onChange={v=>setField("Left Vision",v)} t={t}/>
              <TextInput label="Right Eye Vision" value={form["Right Vision"]} onChange={v=>setField("Right Vision",v)} t={t}/>
            </div>
            <YesNoToggle label="With Corrective Lens" value={checks["With Corrective Lens"]?"yes":"no"} onChange={v=>setCheck("With Corrective Lens",v==="yes")} t={t}/>
          </SectionCard>

          <SectionCard title="Social History" t={t}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {SOCIAL_CHECKBOX_PAIRS.map(({label,yes,no}) => <YesNoToggle key={yes} label={label} value={getPair(yes,no)} onChange={v=>setPair(yes,no,v)} t={t}/>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
              <TextInput label="Smoking Details" value={form["Smoking Details"]} onChange={v=>setField("Smoking Details",v)} t={t}/>
              <TextInput label="Drinking Details" value={form["Drinking Details"]} onChange={v=>setField("Drinking Details",v)} t={t}/>
              <TextInput label="Exercising Details" value={form["Exercising Details"]} onChange={v=>setField("Exercising Details",v)} t={t}/>
            </div>
          </SectionCard>

          <SectionCard title="Disability, PWD & Laterality" t={t}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:12 }}>
              {DISABILITY_CHECKBOX_PAIRS.map(({label,yes,no}) => <YesNoToggle key={yes} label={label} value={getPair(yes,no)} onChange={v=>setPair(yes,no,v)} t={t}/>)}
            </div>
            <TextInput label="Type of Disability" value={form["Type of disability"]} onChange={v=>setField("Type of disability",v)} t={t}/>
            <div style={{ marginTop:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:t.textSub, display:"block", marginBottom:4 }}>Hand Laterality</label>
              <div style={{ display:"flex", gap:8 }}>
                {LATERALITY_CHECKBOXES.map(opt => (
                  <button key={opt} onClick={() => { const n={}; LATERALITY_CHECKBOXES.forEach(o=>n[o]=(o===opt)); setChecks(c=>({...c,...n})); }}
                    style={{ flex:1, padding:"8px", borderRadius:8, border:`1.5px solid ${checks[opt]?t.accent:t.cardBorder}`, background:checks[opt]?t.accentBg:t.card, color:checks[opt]?t.accent:t.textSub, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Diagnosis" t={t}>
            <TextInput label="Diagnosis / Impression" value={form["Diagnosis Impression"]} onChange={v=>setField("Diagnosis Impression",v)} t={t} multiline/>
          </SectionCard>

          <SectionCard title="Physical Examination Findings" t={t}>
            {FINDINGS_FIELDS.map(({key,label,normalKey}) => (
              <NormalAbnormalField key={key} label={label} normal={getNormal(normalKey)} findings={form[key]}
                onNormalChange={v=>setNormal(normalKey,key,v)} onFindingsChange={v=>setField(key,v)} t={t}/>
            ))}
          </SectionCard>

          <SectionCard title="Assessment & Sign-off" t={t}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:t.textSub, display:"block", marginBottom:6 }}>Physician's Assessment</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {ASSESSMENT_CHECKBOXES.map(opt => (
                  <label key={opt} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:13, color:t.text, padding:"8px 12px", border:`1.5px solid ${checks[opt]?t.accent:t.cardBorder}`, borderRadius:8, background:checks[opt]?t.accentBg:t.card }}>
                    <input type="checkbox" checked={!!checks[opt]} onChange={e=>setCheck(opt,e.target.checked)} style={{ width:16, height:16, accentColor:t.accent }}/>
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              {ASSESSMENT_TEXT_FIELDS.map(({key,label}) => (
                <TextInput key={key} label={label} value={form[key]} onChange={v=>setField(key,v)}
                  t={t} multiline={key==="Restrictions Details"||key==="Clearance Specialty Reason"}/>
              ))}
            </div>
          </SectionCard>

          <button onClick={handleSave} disabled={saving}
            style={{ width:"100%", padding:"14px", background:t.accentBtn, color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:saving?0.7:1, marginBottom:24 }}>
            {saving ? "Saving…" : "Save & Mark MEF as Filled"}
          </button>
        </div>

        {/* Right panel — static PNG + live HTML overlay */}
        <div ref={containerRef} style={{ flex:1, height:isMobile?"60vw":"100%", minHeight:isMobile?280:0, background:"#374151", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"#1f2937", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {!imgLoaded && <span style={{ fontSize:11, color:"#9ca3af" }}>Loading…</span>}
              {imgLoaded && <span style={{ fontSize:11, color:"#6ee7b7" }}>Type directly in the preview fields →</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setZoom(z=>Math.max(0.5,parseFloat((z-0.25).toFixed(2))))} disabled={zoom<=0.5}
                style={{ background:"none", border:"none", cursor:zoom<=0.5?"not-allowed":"pointer", color:zoom<=0.5?"#4b5563":"#d1d5db", padding:4, display:"flex", alignItems:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <span style={{ fontSize:12, fontWeight:700, color:"#d1d5db", minWidth:40, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
              <button onClick={()=>setZoom(z=>Math.min(3.0,parseFloat((z+0.25).toFixed(2))))} disabled={zoom>=3.0}
                style={{ background:"none", border:"none", cursor:zoom>=3.0?"not-allowed":"pointer", color:zoom>=3.0?"#4b5563":"#d1d5db", padding:4, display:"flex", alignItems:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
            </div>
          </div>

          <div style={{ flex:1, overflow:"auto", padding:"12px" }}>
            <div style={{ position:"relative", display:"inline-block" }}>
              <img
                src="/medical-examination-form.png"
                alt="Medical Examination Form"
                onLoad={() => { setImgLoaded(true); updateScale(); }}
                style={{ display:"block", width:fitWidth?`${fitWidth}px`:"100%", height:fitWidth?`${fitHeight}px`:"auto", borderRadius:4, margin:zoom<=1?"0 auto":"0" }}
              />
              {imgLoaded && fitScale > 0 && (
                <PdfFieldOverlay
                  form={form} checks={checks} studentFields={studentFields}
                  onFormChange={setField} onCheckChange={setCheck} fitScale={fitScale}
                />
              )}
            </div>
          </div>

          <div style={{ padding:"12px 16px", background:"#1f2937" }}>
            <button onClick={handleDownload} disabled={downloading}
              style={{ width:"100%", padding:"11px", background:t.accentBtn, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:downloading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading ? "Generating…" : "Download filled MEF PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}