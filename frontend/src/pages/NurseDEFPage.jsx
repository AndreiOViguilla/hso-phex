import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { useIsMobile } from "../utils/useIsMobile";
import { DEF_PDF_FIELDS, DEF_PDF_WIDTH, DEF_PDF_HEIGHT } from "../utils/defPdfFields";

// Field ownership
const DEF_STUDENT_FIELDS = new Set(["Name", "ID No"]);

// Separate field lists
const TEXT_FIELDS = DEF_PDF_FIELDS.filter(f => f.type === "text");
const NAMED_CHECKBOXES = DEF_PDF_FIELDS.filter(f => f.type === "checkbox" && !f.name.startsWith("Checkbox_"));
const TOOTH_CHECKBOXES = DEF_PDF_FIELDS.filter(f => f.type === "checkbox" && f.name.startsWith("Checkbox_"));
const ALL_CHECKBOX_NAMES = [...NAMED_CHECKBOXES, ...TOOTH_CHECKBOXES].map(f => f.name);

const ASSESSMENT_TEXT_FIELDS = [
  { key: "Assigned Dentist", label: "Assigned Dentist" },
  { key: "Date",             label: "Date" },
  { key: "Academic Year",    label: "Academic Year" },
];
const REMARKS_FIELDS = [
  { key: "Other Remarks 1", label: "Other Remarks 1" },
  { key: "Other Remarks 2", label: "Other Remarks 2" },
  { key: "Other Remarks 3", label: "Other Remarks 3" },
  { key: "Other Remarks 4", label: "Other Remarks 4" },
];
const OTHERS_TEXT_FIELD = { key: "Others Text", label: "Others (specify)" };
const ORAL_HEALTH_CHECKBOXES = ["Good oral hygiene", "Calcular deposits", "Gingivitis", "Pyorrheatic"];
const DENTURE_PAIRS = [
  { label: "Denture wearer", up: "Denture wearer up", down: "Denture wearer down" },
  { label: "Ortho braces",   up: "Ortho braces up",    down: "Ortho braces down" },
];
const HAWLEYS_CHECKBOX = "Hawleys retainers";

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
        ? <textarea style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
        : <input style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />}
    </div>
  );
}

// The live editable overlay — positioned inputs/checkboxes exactly over PDF fields
function PdfFieldOverlay({ form, checks, studentFields, onFormChange, onCheckChange, fitScale, fitWidth, fitHeight }) {
  const allValues = { ...studentFields, ...form };

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: fitWidth, height: fitHeight, pointerEvents: "none" }}>
      {/* Text fields */}
      {TEXT_FIELDS.map(f => {
        const isStudent = DEF_STUDENT_FIELDS.has(f.name);
        const value = allValues[f.name] || "";
        return (
          <input
            key={f.name}
            value={value}
            readOnly={isStudent}
            onChange={e => onFormChange(f.name, e.target.value)}
            style={{
              position: "absolute",
              left: f.x * fitScale,
              top: f.y * fitScale,
              width: f.w * fitScale,
              height: f.h * fitScale,
              fontSize: Math.max(5, Math.min(f.h * fitScale * 0.7, 11)),
              fontFamily: "Helvetica, Arial, sans-serif",
              border: "none",
              outline: "none",
              background: isStudent ? "transparent" : "rgba(255,255,240,0.85)",
              color: "#111",
              padding: "0 2px",
              boxSizing: "border-box",
              pointerEvents: isStudent ? "none" : "auto",
              cursor: isStudent ? "default" : "text",
            }}
          />
        );
      })}

      {/* Named checkboxes (oral health) */}
      {NAMED_CHECKBOXES.map(f => (
        <div
          key={f.name}
          onClick={() => onCheckChange(f.name, !checks[f.name])}
          style={{
            position: "absolute",
            left: f.x * fitScale,
            top: f.y * fitScale,
            width: f.w * fitScale,
            height: f.h * fitScale,
            cursor: "pointer",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checks[f.name] && (
            <div style={{
              width: f.w * fitScale * 0.6,
              height: f.h * fitScale * 0.32,
              borderLeft: `${Math.max(1.5, f.w * fitScale * 0.18)}px solid #111`,
              borderBottom: `${Math.max(1.5, f.w * fitScale * 0.18)}px solid #111`,
              transform: "rotate(-45deg)",
              marginTop: `-${f.h * fitScale * 0.08}px`,
            }} />
          )}
        </div>
      ))}

      {/* Tooth chart checkboxes (Checkbox_N) — clickable */}
      {TOOTH_CHECKBOXES.map(f => (
        <div
          key={f.name}
          onClick={() => onCheckChange(f.name, !checks[f.name])}
          style={{
            position: "absolute",
            left: f.x * fitScale,
            top: f.y * fitScale,
            width: f.w * fitScale,
            height: f.h * fitScale,
            cursor: "pointer",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checks[f.name] && (
            <div style={{
              width: f.w * fitScale * 0.6,
              height: f.h * fitScale * 0.32,
              borderLeft: `${Math.max(1.5, f.w * fitScale * 0.18)}px solid #111`,
              borderBottom: `${Math.max(1.5, f.w * fitScale * 0.18)}px solid #111`,
              transform: "rotate(-45deg)",
              marginTop: `-${f.h * fitScale * 0.08}px`,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NurseDEFPage({ studentMongoId, onBack, onSaved }) {
  const { t } = useTheme();
  const { show } = useModal();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentFields, setStudentFields] = useState({ Name: "", "ID No": "" });
  const [form, setForm] = useState({});
  const [checks, setChecks] = useState({});
  const [zoom, setZoom] = useState(1.0);
  const [fitScale, setFitScale] = useState(1.0);
  const [fitWidth, setFitWidth] = useState(0);
  const [fitHeight, setFitHeight] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Calculate fitScale from image's displayed size vs PDF natural size
  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const panelW = (container.clientWidth || 700) - 24;
    const baseWidth = Math.max(panelW, 280);
    const fw = baseWidth * zoom;
    const fs = fw / DEF_PDF_WIDTH;
    const fh = DEF_PDF_HEIGHT * fs;
    setFitScale(fs);
    setFitWidth(fw);
    setFitHeight(fh);
  }, [zoom]);

  useEffect(() => { updateScale(); }, [zoom, imgLoaded, updateScale]);

  useEffect(() => {
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  // Load student data
  useEffect(() => {
    fetch(`/api/hso/students/${studentMongoId}/def`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return; }
        setStudentInfo(data.student);
        const fd = data.formData || {};
        setStudentFields({ Name: fd["Name"] || "", "ID No": fd["ID No"] || "" });

        const nurseVals = {};
        [...ASSESSMENT_TEXT_FIELDS.map(f => f.key), ...REMARKS_FIELDS.map(f => f.key), OTHERS_TEXT_FIELD.key]
          .forEach(k => { nurseVals[k] = fd[k] || ""; });
        setForm(nurseVals);

        const checkVals = {};
        ALL_CHECKBOX_NAMES.forEach(k => { checkVals[k] = !!fd[k]; });
        setChecks(checkVals);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentMongoId]);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCheck = useCallback((key, value) => setChecks(c => ({ ...c, [key]: value })), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, ...checks };
      const r = await fetch(`/api/hso/students/${studentMongoId}/def`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        show({ type: "success", message: "DEF saved and marked as filled." });
        if (onSaved) onSaved();
      } else {
        show({ type: "error", message: "Failed to save DEF." });
      }
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const payload = { ...form, ...checks };
      const resp = await fetch(`/api/hso/students/${studentMongoId}/def/pdf/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate PDF");
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `DEF_${studentFields["ID No"] || studentInfo?.studentId || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      show({ type: "error", title: "Download failed", message: e.message });
    }
    setDownloading(false);
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
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: `1px solid ${t.divider}`, background: t.card }}>
        <button onClick={onBack} style={{ background: t.bg, border: `1px solid ${t.cardBorder}`, color: t.text, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{studentInfo?.firstName} {studentInfo?.lastName}</div>
        <div style={{ fontSize: 12, color: t.textSub }}>· {studentInfo?.studentId}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>
        {/* Left panel */}
        <div style={{ flex: isMobile ? "none" : "0 0 50%", minWidth: isMobile ? "none" : 380, maxWidth: isMobile ? "none" : 620, borderRight: isMobile ? "none" : `1px solid ${t.divider}`, overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", boxSizing: "border-box" }}>

          <SectionCard title="Oral Health Findings" t={t}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {ORAL_HEALTH_CHECKBOXES.map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[opt] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[opt] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[opt]} onChange={e => setCheck(opt, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  {opt}
                </label>
              ))}
            </div>
            {DENTURE_PAIRS.map(({ label, up, down }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: up, l: "Upper" }, { key: down, l: "Lower" }].map(({ key, l }) => (
                    <label key={key} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[key] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[key] ? t.accentBg : t.card }}>
                      <input type="checkbox" checked={!!checks[key]} onChange={e => setCheck(key, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[HAWLEYS_CHECKBOX] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[HAWLEYS_CHECKBOX] ? t.accentBg : t.card }}>
              <input type="checkbox" checked={!!checks[HAWLEYS_CHECKBOX]} onChange={e => setCheck(HAWLEYS_CHECKBOX, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
              {HAWLEYS_CHECKBOX}
            </label>
          </SectionCard>

          <SectionCard title="Other Notes" t={t}>
            <div style={{ marginBottom: 12 }}>
              <TextInput
                label={OTHERS_TEXT_FIELD.label}
                value={form[OTHERS_TEXT_FIELD.key]}
                onChange={v => {
                  setField(OTHERS_TEXT_FIELD.key, v);
                  const shouldCheck = v.trim().length > 0;
                  setCheck("Others", shouldCheck);
                }}
                t={t}
              />
              {checks["Others"] && (
                <div style={{ fontSize: 11, color: t.accent, marginTop: 4 }}>
                  ✓ "Others" checkbox will be checked in the PDF
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {REMARKS_FIELDS.map(({ key, label }) => (
                <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
              ))}
            </div>
          </SectionCard>

          <button onClick={handleSave} disabled={saving}
            style={{ width: "100%", padding: "14px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, marginBottom: 24 }}>
            {saving ? "Saving…" : "Save & Mark DEF as Filled"}
          </button>
        </div>

        {/* Right panel — static PDF canvas + live HTML overlay */}
        <div ref={containerRef} style={{ flex: 1, height: isMobile ? "60vw" : "100%", minHeight: isMobile ? 280 : 0, background: "#374151", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!imgLoaded && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading…</span>}
              {imgLoaded && <span style={{ fontSize: 11, color: "#6ee7b7" }}>Click checkboxes directly in the preview →</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))} disabled={zoom <= 0.5}
                style={{ background: "none", border: "none", cursor: zoom <= 0.5 ? "not-allowed" : "pointer", color: zoom <= 0.5 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db", minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))))} disabled={zoom >= 3.0}
                style={{ background: "none", border: "none", cursor: zoom >= 3.0 ? "not-allowed" : "pointer", color: zoom >= 3.0 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                ref={imgRef}
                src="/dental-form.png"
                alt="Dental Examination Form"
                width={fitWidth || undefined}
                onLoad={() => { setImgLoaded(true); updateScale(); }}
                style={{
                  display: "block",
                  width: fitWidth ? `${fitWidth}px` : "100%",
                  height: fitWidth ? `${fitHeight}px` : "auto",
                  borderRadius: 4,
                  margin: zoom <= 1 ? "0 auto" : "0",
                }}
              />
              {imgLoaded && fitScale > 0 && (
                <PdfFieldOverlay
                  form={form}
                  checks={checks}
                  studentFields={studentFields}
                  onFormChange={setField}
                  onCheckChange={setCheck}
                  fitScale={fitScale}
                  fitWidth={fitWidth}
                  fitHeight={fitHeight}
                />
              )}
            </div>
          </div>

          <div style={{ padding: "12px 16px", background: "#1f2937" }}>
            <button onClick={handleDownloadPDF} disabled={downloading}
              style={{ width: "100%", padding: "11px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: downloading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading ? "Generating…" : "Download filled DEF PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}