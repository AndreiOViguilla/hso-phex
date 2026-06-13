import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { useIsMobile } from "../utils/useIsMobile";
import { renderFieldOwnerTooltips } from "../fieldOwnerTooltips";

// DEF field ownership: Name/ID No come from the student, everything else is filled by the nurse/dentist.
const DEF_STUDENT_FIELDS = new Set(["Name", "ID No"]);
function getDefFieldOwner(fieldName) {
  return DEF_STUDENT_FIELDS.has(fieldName) ? "Student" : "Nurse";
}


// ── Field name constants (must match PDF form field names exactly) ──────────

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

const ORAL_HEALTH_CHECKBOXES = [
  "Good oral hygiene",
  "Calcular deposits",
  "Gingivitis",
  "Pyorrheatic",
];

const DENTURE_PAIRS = [
  { label: "Denture wearer", up: "Denture wearer up", down: "Denture wearer down" },
  { label: "Ortho braces",   up: "Ortho braces up",    down: "Ortho braces down" },
];

const HAWLEYS_CHECKBOX = "Hawleys retainers";

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

// ── Main Component ───────────────────────────────────────────────────────

export default function NurseDEFPage({ studentMongoId, onBack, onSaved }) {
  const { t } = useTheme();
  const { show } = useModal();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentFields, setStudentFields] = useState({});
  const [form, setForm] = useState({});       // text fields (nurse-editable)
  const [checks, setChecks] = useState({});   // checkbox fields

  const canvasRef = useRef(null);
  const tooltipLayerRef = useRef(null);
  const pdfDocRef = useRef(null);
  const scaleRef  = useRef(1);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    fetch(`/api/hso/students/${studentMongoId}/def`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return; }
        setStudentInfo(data.student);
        const fd = data.formData || {};

        setStudentFields({ "Name": fd["Name"] || "", "ID No": fd["ID No"] || "" });

        const nurseVals = {};
        const allNurseKeys = [
          ...ASSESSMENT_TEXT_FIELDS.map(f => f.key),
          ...REMARKS_FIELDS.map(f => f.key),
          OTHERS_TEXT_FIELD.key,
        ];
        allNurseKeys.forEach(k => { nurseVals[k] = fd[k] || ""; });
        setForm(nurseVals);

        const checkVals = {};
        const allCheckKeys = [
          ...ORAL_HEALTH_CHECKBOXES,
          ...DENTURE_PAIRS.flatMap(p => [p.up, p.down]),
          HAWLEYS_CHECKBOX,
        ];
        allCheckKeys.forEach(k => { checkVals[k] = !!fd[k]; });
        setChecks(checkVals);

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentMongoId]);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCheck = (key, value) => setChecks(c => ({ ...c, [key]: value }));

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

  // Ensure pdf.js + viewer (annotation layer) assets are loaded once
  useEffect(() => {
    const ensurePdfJs = async () => {
      if (!document.getElementById("pdfjs-annotation-css")) {
        const link = document.createElement("link");
        link.id = "pdfjs-annotation-css";
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";
        document.head.appendChild(link);
      }
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      if (!window.pdfjsViewer) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
    };
    ensurePdfJs();
  }, []);

  const annotationLayerRef = useRef(null);

  // Fetch the live-filled PDF (with AcroForm intact) from the backend and load it for preview
  const loadFilledPdf = useCallback(async () => {
    if (!window.pdfjsLib) return;
    setRendering(true);
    try {
      const payload = { ...form, ...checks };
      const resp = await fetch(`/api/hso/students/${studentMongoId}/def/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("not found");
      const buf = await resp.arrayBuffer();
      pdfDocRef.current = await window.pdfjsLib.getDocument({ data: buf }).promise;
      setPdfReady(true);
      setPdfError(false);
    } catch (e) {
      setPdfError(true);
    }
    setRendering(false);
  }, [form, checks, studentMongoId]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => { loadFilledPdf(); }, 600);
    return () => clearTimeout(timer);
  }, [form, checks, loading, loadFilledPdf]);

  const renderPreview = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(1);
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const previewPanel = container?.parentElement;
      const panelW = (previewPanel?.clientWidth || canvas.parentElement?.clientWidth || 700) - 24;
      const pdfNatural = page.getViewport({ scale: 1 });
      const baseWidth = Math.max(panelW, 280);
      const fitWidth = baseWidth * zoom;
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      scaleRef.current = renderScale;

      const viewport = page.getViewport({ scale: renderScale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = zoom <= 1 ? "0 auto" : "0";
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      const annotationDiv = annotationLayerRef.current;
      if (annotationDiv && window.pdfjsViewer) {
        annotationDiv.innerHTML = "";
        const cssViewport = page.getViewport({ scale: fitScale });
        annotationDiv.style.width  = `${fitWidth}px`;
        annotationDiv.style.height = `${pdfNatural.height * fitScale}px`;
        annotationDiv.style.margin = zoom <= 1 ? "0 auto" : "0";

        try {
          const annotations = await page.getAnnotations({ intent: "display" });
          const linkService = {
            getDestinationHash: () => "#",
            getAnchorUrl: () => "#",
            addLinkAttributes: () => {},
            executeNamedAction: () => {},
            isPageVisible: () => true,
            eventBus: new window.pdfjsViewer.EventBus(),
          };
          window.pdfjsViewer.AnnotationLayer.render({
            viewport: cssViewport.clone({ dontFlip: true }),
            div: annotationDiv,
            annotations,
            page,
            renderForms: true,
            linkService,
            downloadManager: null,
            imageResourcesPath: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/web/images/",
          });

          // pdf.js's pdf_viewer.css gives form widgets pointer-events:auto,
          // which would block our hover-tooltip layer underneath. Disable
          // pointer events on every rendered widget so hover passes through.
          annotationDiv.querySelectorAll("input, textarea, select, section")
            .forEach(el => { el.style.pointerEvents = "none"; });
        } catch (_) {}
      }

      const tooltipDiv = tooltipLayerRef.current;
      if (tooltipDiv) {
        await renderFieldOwnerTooltips({
          page,
          cssViewport,
          container: tooltipDiv,
          fitWidth,
          fitHeight,
          getFieldOwner: getDefFieldOwner,
        });
      }
    } catch (e) { console.error("[NurseDEF] Render error:", e); }
    setRendering(false);
  }, [zoom]);

  useEffect(() => {
    if (!pdfReady) return;
    renderPreview();
  }, [pdfReady, zoom, renderPreview]);

  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => renderPreview();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, renderPreview]);

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
      {/* Slim back bar */}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: `1px solid ${t.divider}`, background: t.card }}>
        <button onClick={onBack} style={{ background: t.bg, border: `1px solid ${t.cardBorder}`, color: t.text, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{studentInfo?.firstName} {studentInfo?.lastName}</div>
        <div style={{ fontSize: 12, color: t.textSub }}>· {studentInfo?.studentId}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: isMobile ? "none" : "0 0 50%", minWidth: isMobile ? "none" : 380, maxWidth: isMobile ? "none" : 620, borderRight: isMobile ? "none" : `1px solid ${t.divider}`, overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", boxSizing: "border-box" }}>

        {/* Assigned details */}
        <SectionCard title="Examination Details" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {ASSESSMENT_TEXT_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        {/* Oral health checkboxes */}
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
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[up] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[up] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[up]} onChange={e => setCheck(up, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  Upper
                </label>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[down] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[down] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[down]} onChange={e => setCheck(down, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  Lower
                </label>
              </div>
            </div>
          ))}

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[HAWLEYS_CHECKBOX] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[HAWLEYS_CHECKBOX] ? t.accentBg : t.card }}>
            <input type="checkbox" checked={!!checks[HAWLEYS_CHECKBOX]} onChange={e => setCheck(HAWLEYS_CHECKBOX, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
            {HAWLEYS_CHECKBOX}
          </label>
        </SectionCard>

        {/* Other notes */}
        <SectionCard title="Other Notes" t={t}>
          <div style={{ marginBottom: 12 }}>
            <TextInput label={OTHERS_TEXT_FIELD.label} value={form[OTHERS_TEXT_FIELD.key]} onChange={v => setField(OTHERS_TEXT_FIELD.key, v)} t={t} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {REMARKS_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "14px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, marginBottom: 24 }}>
          {saving ? "Saving…" : "Save & Mark DEF as Filled"}
        </button>
        </div>

      {/* PDF Preview panel */}
      <div style={{ flex: 1, height: isMobile ? "60vw" : "100%", minHeight: isMobile ? 280 : 0, background: "#374151", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {rendering && <span style={{ fontSize: 11, color: "#9ca3af" }}>Updating…</span>}
            {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading preview…</span>}
            {pdfError && <span style={{ fontSize: 11, color: "#fca5a5" }}>Preview PDF not found</span>}
            {pdfReady && !rendering && <span style={{ fontSize: 11, color: "#6ee7b7" }}>Hover a field to see who fills it →</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
              title="Zoom out" disabled={zoom <= 0.5}
              style={{ background: "none", border: "none", cursor: zoom <= 0.5 ? "not-allowed" : "pointer", color: zoom <= 0.5 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db", minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))))}
              title="Zoom in" disabled={zoom >= 3.0}
              style={{ background: "none", border: "none", cursor: zoom >= 3.0 ? "not-allowed" : "pointer", color: zoom >= 3.0 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          {pdfError ? (
            <div style={{ color: "#d1d5db", fontSize: 13, padding: 20, lineHeight: 1.8 }}>
              <strong>Preview unavailable</strong><br /><br />
              Make sure <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>backend/public/dental-form.pdf</code> exists on the server with all DEF fields.
            </div>
          ) : (
            <div style={{ position: "relative", display: "inline-block" }}>
              <canvas ref={canvasRef} style={{ borderRadius: 4, display: "block" }} />
              <div
                ref={annotationLayerRef}
                className="annotationLayer"
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              />
              <div ref={tooltipLayerRef} style={{ position: "absolute", top: 0, left: 0 }} />
            </div>
          )}
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