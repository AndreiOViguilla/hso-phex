import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";

const EMPTY_FORM = {
  idNumber:        "",
  date:            new Date().toISOString().split("T")[0],
  lastName:        "",
  firstName:       "",
  mi:              "",
  gender:          "",
  birthday:        "",
  contact:         "",
  college:         "",
  academicYear:    "2025-2026",
  emergencyName:   "",
  emergencyRel:    "",
  emergencyContact:"",
  studentNameAuth: "",
  studentAge:      "",
};

function buildFieldMap(f) {
  return {
    "ID Number":          f.idNumber,
    "Date":               f.date,
    "Last Name":          f.lastName,
    "First Name":         f.firstName,
    "MI":                 f.mi,
    "Birthday":           f.birthday,
    "Contact Number":     f.contact,
    "College Section":    f.college,
    "Academic Year":      f.academicYear,
    "Emergency Name":     f.emergencyName,
    "Relationship":       f.emergencyRel,
    "Emergency Contact":  f.emergencyContact,
    "Student Name Auth":  f.studentNameAuth,
    "Student Age":        f.studentAge,
    "Gender Female":      f.gender === "Female" ? "Yes" : "Off",
    "Gender Male":        f.gender === "Male"   ? "Yes" : "Off",
  };
}

// Maps AcroForm field name → form input element ID
const FIELD_TO_INPUT_ID = {
  "ID Number":         "mef-idNumber",
  "Date":              "mef-date",
  "Last Name":         "mef-lastName",
  "First Name":        "mef-firstName",
  "MI":                "mef-mi",
  "Birthday":          "mef-birthday",
  "Contact Number":    "mef-contact",
  "College Section":   "mef-college",
  "Academic Year":     "mef-academicYear",
  "Emergency Name":    "mef-emergencyName",
  "Relationship":      "mef-emergencyRel",
  "Emergency Contact": "mef-emergencyContact",
  "Student Name Auth": "mef-studentNameAuth",
  "Student Age":       "mef-studentAge",
  "Gender Female":     "mef-gender-Female",
  "Gender Male":       "mef-gender-Male",
};

// Reverse: input id → AcroForm field name
const INPUT_ID_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_INPUT_ID).map(([k, v]) => [v, k])
);

export default function MEFPage({ prefillId, prefillFirstName, prefillLastName, prefillMI, prefillGender, onBack, onSuccess }) {
  const isMobile    = useIsMobile();
  const { dark, t } = useTheme();
  const canvasRef   = useRef(null);
  const pdfDocRef   = useRef(null);
  const pdfBytesRef = useRef(null);
  const renderTimeout = useRef(null);
  const scaleRef    = useRef(1); // current render scale for click mapping

  const [pdfReady,    setPdfReady]    = useState(false);
  const [pdfError,    setPdfError]    = useState(false);
  const [rendering,   setRendering]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [zoom, setZoom] = useState(1.0); // 1.0 = 100% // field name currently highlighted

  const buildAuth = (fn, mi, ln) =>
    fn && ln ? `${fn}${mi ? " " + mi : ""} ${ln}` : "";

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    idNumber:        prefillId        || "",
    firstName:       prefillFirstName || "",
    lastName:        prefillLastName  || "",
    mi:              prefillMI        || "",
    studentNameAuth: buildAuth(prefillFirstName, prefillMI, prefillLastName),
  });

  // Fetch fresh user data from backend on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/students/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) return;
        let age = "";
        if (user.birthday) {
          const birth = new Date(user.birthday);
          const today = new Date();
          age = String(today.getFullYear() - birth.getFullYear() -
            (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0));
        }
        setForm(f => ({
          ...f,
          idNumber:        user.studentId     || f.idNumber,
          firstName:       user.firstName     || f.firstName,
          lastName:        user.lastName      || f.lastName,
          mi:              user.middleInitial || f.mi,
          gender:          user.gender        || f.gender,
          birthday:        user.birthday      || f.birthday,
          contact:         user.contact       || f.contact,
          college:         user.college       || f.college,
          studentAge:      age               || f.studentAge,
          studentNameAuth: user.firstName && user.lastName
            ? buildAuth(user.firstName, user.middleInitial, user.lastName)
            : f.studentNameAuth,
        }));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── AcroForm field positions (at 1x PDF scale) ───────────────────────────
  const TEXT_FIELDS = [
    { name: "ID Number",          x: 88,  y: 103, w: 125, h: 11 },
    { name: "Date",               x: 458, y: 104, w: 90,  h: 11 },
    { name: "Last Name",          x: 88,  y: 117, w: 125, h: 11 },
    { name: "First Name",         x: 271, y: 116, w: 160, h: 11 },
    { name: "MI",                 x: 449, y: 117, w: 99,  h: 11 },
    { name: "Birthday",           x: 237, y: 131, w: 70,  h: 11 },
    { name: "Contact Number",     x: 400, y: 131, w: 150, h: 11 },
    { name: "College Section",    x: 161, y: 144, w: 210, h: 11 },
    { name: "Academic Year",      x: 444, y: 145, w: 106, h: 10 },
    { name: "Emergency Name",     x: 221, y: 158, w: 145, h: 11 },
    { name: "Relationship",       x: 435, y: 158, w: 115, h: 11 },
    { name: "Emergency Contact",  x: 182, y: 171, w: 367, h: 11 },
    { name: "Student Name Auth",  x: 44,  y: 220, w: 109, h: 11 },
    { name: "Student Age",        x: 161, y: 220, w: 20,  h: 11 },
  ];
  const CHECK_FIELDS = [
    { name: "Gender Female", x: 89,  y: 134, w: 8, h: 8 },
    { name: "Gender Male",   x: 141, y: 134, w: 8, h: 7 },
  ];
  const ALL_FIELDS = [...TEXT_FIELDS, ...CHECK_FIELDS];

  // ── Canvas click → focus matching input ──────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Click position relative to canvas in CSS pixels
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Convert to PDF units (1x scale)
    const cssW = parseFloat(canvas.style.width) || rect.width;
    const cssH = parseFloat(canvas.style.height) || rect.height;
    const pdfW = canvas.width / scaleRef.current;
    const pdfH = canvas.height / scaleRef.current;
    const px = (cx / cssW) * pdfW;
    const py = (cy / cssH) * pdfH;

    // Find which field was clicked
    const hit = ALL_FIELDS.find(f =>
      px >= f.x && px <= f.x + f.w &&
      py >= f.y && py <= f.y + f.h
    );

    if (hit) {
      setHighlighted(hit.name);
      const inputId = FIELD_TO_INPUT_ID[hit.name];
      if (inputId) {
        const el = document.getElementById(inputId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => { el.focus(); el.select?.(); }, 300);
        }
      }
    }
  }, [ALL_FIELDS]);

  // ── Load pdf.js + PDF bytes ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
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
        const resp = await fetch("/medical-examination-form.pdf");
        if (!resp.ok) throw new Error("not found");
        const buf = await resp.arrayBuffer();
        pdfBytesRef.current = buf.slice(0);
        pdfDocRef.current = await window.pdfjsLib.getDocument({ data: buf }).promise;
        setPdfReady(true);
      } catch (e) { setPdfError(true); }
    };
    load();
  }, []);

  // Offscreen canvas holds the pure PDF render — never redrawn unless form/size changes
  const offscreenRef = useRef(null);

  const drawOverlay = useCallback((ctx, f, hl, s) => {
    const fm = buildFieldMap(f);
    TEXT_FIELDS.forEach(({ name, x, y, w, h }) => {
      const value = fm[name];
      const isHl  = hl === name;
      ctx.fillStyle = isHl ? "rgba(59,130,246,0.28)" : value ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.05)";
      ctx.fillRect(x * s, y * s, w * s, h * s);
      ctx.strokeStyle = isHl ? "#1d4ed8" : value ? "#3b82f6" : "rgba(59,130,246,0.35)";
      ctx.lineWidth = isHl ? 2 * s : value ? 1.2 * s : 0.7 * s;
      ctx.strokeRect(x * s, y * s, w * s, h * s);
      if (value) {
        ctx.fillStyle = "#1d4ed8";
        ctx.font = `${7 * s}px Arial`;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x * s, y * s, w * s, h * s);
        ctx.clip();
        ctx.fillText(String(value), (x + 1.5) * s, (y + h - 2.5) * s);
        ctx.restore();
      }
    });
    CHECK_FIELDS.forEach(({ name, x, y, w, h }) => {
      const checked = name === "Gender Female" ? f.gender === "Female" : f.gender === "Male";
      const isHl = hl === name;
      ctx.fillStyle = isHl ? "rgba(59,130,246,0.3)" : checked ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.05)";
      ctx.fillRect(x * s, y * s, w * s, h * s);
      ctx.strokeStyle = isHl ? "#1d4ed8" : "#3b82f6";
      ctx.lineWidth = isHl ? 2 * s : 1.2 * s;
      ctx.strokeRect(x * s, y * s, w * s, h * s);
      if (checked) {
        ctx.fillStyle = "#1d4ed8";
        ctx.font = `bold ${8 * s}px Arial`;
        ctx.fillText("✓", (x + 0.5) * s, (y + h - 0.5) * s);
      }
    });
  }, []);

  // Composite: copy offscreen PDF + draw overlay — NO re-render of PDF
  const composite = useCallback((f, hl) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;
    const ctx = canvas.getContext("2d");
    // Paste the frozen PDF render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0);
    // Draw overlay on top
    drawOverlay(ctx, f, hl, scaleRef.current);
  }, [drawOverlay]);

  // Full render: render PDF to offscreen, then composite
  const renderPreview = useCallback(async (f, hl) => {
    const zoomLevel = zoom;
    if (!pdfDocRef.current || !canvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(1);
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const previewPanel = container?.parentElement;
      const panelW = (previewPanel ? previewPanel.clientWidth : 700) - 24;
      const pdfNatural = page.getViewport({ scale: 1 });
      const baseWidth = Math.max(panelW, 280);
      const fitWidth = baseWidth * zoomLevel;
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      scaleRef.current = renderScale;

      const viewport = page.getViewport({ scale: renderScale });

      // Size the visible canvas
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = currentZoom <= 1 ? "0 auto" : "0";  // center when small, align left when zoomed
      canvas.style.cursor  = "pointer";

      // Render PDF to offscreen canvas
      const off = document.createElement("canvas");
      off.width  = viewport.width;
      off.height = viewport.height;
      offscreenRef.current = off;
      await page.render({ canvasContext: off.getContext("2d"), viewport }).promise;

      // Composite onto visible canvas
      composite(f, hl);
    } catch (e) { console.error("Render error:", e); }
    setRendering(false);
  }, [composite, zoom]);

  // Re-render PDF only when form data or size changes
  useEffect(() => {
    if (!pdfReady) return;
    clearTimeout(renderTimeout.current);
    const currentForm = form;
    const currentHighlighted = highlighted;
    const currentZoom = zoom;
    renderTimeout.current = setTimeout(async () => {
      // Inline render so zoom is captured in this closure
      const page = await pdfDocRef.current?.getPage(1);
      const canvas = canvasRef.current;
      if (!page || !canvas) return;
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const previewPanel = container?.parentElement;
      const panelW = (previewPanel ? previewPanel.clientWidth : 700) - 24;
      const pdfNatural = page.getViewport({ scale: 1 });
      const baseWidth = Math.max(panelW, 280);
      const fitWidth = baseWidth * currentZoom;  // canvas grows with zoom
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      scaleRef.current = renderScale;
      const viewport = page.getViewport({ scale: renderScale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = currentZoom <= 1 ? "0 auto" : "0";  // center when small, align left when zoomed
      canvas.style.cursor  = "pointer";
      const off = document.createElement("canvas");
      off.width  = viewport.width;
      off.height = viewport.height;
      offscreenRef.current = off;
      await page.render({ canvasContext: off.getContext("2d"), viewport }).promise;
      composite(currentForm, currentHighlighted);
    }, 150);
    return () => clearTimeout(renderTimeout.current);
  }, [form, pdfReady, zoom, composite, highlighted]);

  // Resize — full re-render needed
  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => {
      clearTimeout(renderTimeout.current);
      renderTimeout.current = setTimeout(() => renderPreview(form, highlighted), 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, form, renderPreview, zoom]);

  // Highlight change — composite only, no PDF re-render = no flash
  useEffect(() => {
    if (!pdfReady) return;
    composite(form, highlighted);
  }, [highlighted, pdfReady, composite, form]);

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!pdfBytesRef.current) return;
    setDownloading(true);
    try {
      if (!window.PDFLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { PDFDocument } = window.PDFLib;
      const pdfDoc  = await PDFDocument.load(pdfBytesRef.current.slice(0), { ignoreEncryption: true });
      const pdfForm = pdfDoc.getForm();
      const fieldMap = buildFieldMap(form);
      for (const [name, value] of Object.entries(fieldMap)) {
        try {
          if (value === "Yes" || value === "Off") {
            const cb = pdfForm.getCheckBox(name);
            value === "Yes" ? cb.check() : cb.uncheck();
          } else {
            const tf = pdfForm.getTextField(name);
            tf.setText(value || "");
            tf.enableReadOnly();
          }
        } catch (_) {}
      }
      try { pdfForm.flatten(); } catch (_) {}
      const bytes = await pdfDoc.save({ updateFieldAppearances: false });
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = `MEF_${form.idNumber || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      onSuccess();
    } catch (e) { alert("Download failed: " + e.message); }
    setDownloading(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp = (extra) => ({
    padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box",
    ...extra,
  });
  const lbl = { fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 };
  const sec = { fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1.5px solid ${t.divider}`, paddingBottom: 8, marginBottom: 14 };
  const fld = { display: "flex", flexDirection: "column", gap: 4 };
  const c2  = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 12 };
  const c3  = { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 54px", gap: 10, marginBottom: 12 };

  const formPanel = (
    <div style={{ overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", flex: 1, minWidth: 0, background: t.bg }}>
      <div style={{ marginBottom: 22 }}>
        <div style={sec}>Student information</div>
        <div style={c2}>
          <div style={fld}><label style={lbl}>ID number</label>
            <input id="mef-idNumber" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-idNumber"])} onBlur={() => setHighlighted(null)} value={form.idNumber} onChange={e => set("idNumber", e.target.value)} placeholder="e.g. 12512345" />
          </div>
          <div style={fld}><label style={lbl}>Date</label>
            <input type="date" id="mef-date" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-date"])} onBlur={() => setHighlighted(null)} value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
        </div>
        <div style={c3}>
          <div style={fld}><label style={lbl}>Last name</label>
            <input id="mef-lastName" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-lastName"])} onBlur={() => setHighlighted(null)} placeholder="Dela Cruz" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
          </div>
          <div style={fld}><label style={lbl}>First name</label>
            <input id="mef-firstName" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-firstName"])} onBlur={() => setHighlighted(null)} placeholder="Juan" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
          </div>
          <div style={fld}><label style={lbl}>M.I.</label>
            <input id="mef-mi" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-mi"])} onBlur={() => setHighlighted(null)} placeholder="A." value={form.mi} onChange={e => set("mi", e.target.value)} />
          </div>
        </div>
        <div style={c2}>
          <div style={fld}>
            <label style={lbl}>Gender</label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {["Female", "Male"].map(g => (
                <label key={g} id={`mef-gender-${g}`}
                  onClick={() => setHighlighted(`Gender ${g}`)}
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, flex: 1, padding: "8px 12px", border: `1.5px solid ${form.gender === g ? t.accent : t.inputBorder}`, borderRadius: 8, background: form.gender === g ? t.accentBg : t.input, color: form.gender === g ? t.accent : t.text, transition: "all 0.15s" }}>
                  <input type="radio" name="mef-gender" checked={form.gender === g} onChange={() => set("gender", g)} style={{ accentColor: "#1d4ed8" }} />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div style={fld}><label style={lbl}>Birthday</label>
            <input type="date" id="mef-birthday" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-birthday"])} onBlur={() => setHighlighted(null)} value={form.birthday} onChange={e => set("birthday", e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={fld}><label style={lbl}>Contact number</label>
            <input id="mef-contact" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-contact"])} onBlur={() => setHighlighted(null)} placeholder="09XX-XXX-XXXX" value={form.contact} onChange={e => set("contact", e.target.value)} />
          </div>
        </div>
        <div style={c2}>
          <div style={fld}><label style={lbl}>College / Section</label>
            <input id="mef-college" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-college"])} onBlur={() => setHighlighted(null)} placeholder="CCS / BSCS" value={form.college} onChange={e => set("college", e.target.value)} />
          </div>
          <div style={fld}><label style={lbl}>Academic year</label>
            <input id="mef-academicYear" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-academicYear"])} onBlur={() => setHighlighted(null)} value={form.academicYear} onChange={e => set("academicYear", e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={sec}>Emergency contact</div>
        <div style={c2}>
          <div style={fld}><label style={lbl}>Person to notify</label>
            <input id="mef-emergencyName" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-emergencyName"])} onBlur={() => setHighlighted(null)} placeholder="Full name" value={form.emergencyName} onChange={e => set("emergencyName", e.target.value)} />
          </div>
          <div style={fld}><label style={lbl}>Relationship</label>
            <input id="mef-emergencyRel" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-emergencyRel"])} onBlur={() => setHighlighted(null)} placeholder="Parent" value={form.emergencyRel} onChange={e => set("emergencyRel", e.target.value)} />
          </div>
        </div>
        <div style={fld}><label style={lbl}>Emergency contact number</label>
          <input id="mef-emergencyContact" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-emergencyContact"])} onBlur={() => setHighlighted(null)} placeholder="09XX-XXX-XXXX" value={form.emergencyContact} onChange={e => set("emergencyContact", e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={sec}>Authority to conduct examination</div>
        <div style={c2}>
          <div style={fld}><label style={lbl}>Full name</label>
            <input id="mef-studentNameAuth" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-studentNameAuth"])} onBlur={() => setHighlighted(null)} placeholder="Juan A. Dela Cruz" value={form.studentNameAuth} onChange={e => set("studentNameAuth", e.target.value)} />
          </div>
          <div style={fld}><label style={lbl}>Age</label>
            <input id="mef-studentAge" style={inp()} onFocus={() => setHighlighted(INPUT_ID_TO_FIELD["mef-studentAge"])} onBlur={() => setHighlighted(null)} placeholder="18" type="number" value={form.studentAge} onChange={e => set("studentAge", e.target.value)} />
          </div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: t.textSub, lineHeight: 1.7 }}>
          "I accept and understand that I am required to undergo an offsite entrance physical examination, blood typing, drug test and chest x-ray to determine my fitness and well-being as a student…"
        </div>
      </div>

      <div style={{ background: t.blueBg, border: `1px solid ${t.blue}44`, borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: t.blueText, lineHeight: 1.7 }}>
        By generating this form, you confirm you understand the examination requirements. Results are confidential and will be used for your care. Records are retained for 5 years.
      </div>

      <Btn variant="primary" onClick={handleDownload} style={{ opacity: downloading ? 0.7 : 1 }}>
        {downloading ? "Generating PDF…" : "Generate & download MEF PDF →"}
      </Btn>
      <div style={{ height: 20 }} />
    </div>
  );

  const previewPanel = (
    <div style={{ background: "#374151", display: "flex", flexDirection: "column", flex: 1, minHeight: 320, overflow: "hidden", position: "relative" }}>
      <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {highlighted && <span style={{ fontSize: 11, color: "#93c5fd" }}>↑ {highlighted}</span>}
          {rendering   && <span style={{ fontSize: 11, color: "#9ca3af" }}>Updating…</span>}
          {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading…</span>}
          {pdfError    && <span style={{ fontSize: 11, color: "#fca5a5" }}>PDF not found</span>}
          {pdfReady && !rendering && !highlighted && <span style={{ fontSize: 11, color: "#6ee7b7" }}>Click a field to jump →</span>}
        </div>
        {/* Zoom controls — centered */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
            title="Zoom out" disabled={zoom <= 0.5}
            style={{ background: "none", border: "none", cursor: zoom <= 0.5 ? "not-allowed" : "pointer", color: zoom <= 0.5 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db", minWidth: 40, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))))}
            title="Zoom in" disabled={zoom >= 3.0}
            style={{ background: "none", border: "none", cursor: zoom >= 3.0 ? "not-allowed" : "pointer", color: zoom >= 3.0 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
        {pdfError ? (
          <div style={{ color: "#d1d5db", fontSize: 13, padding: 20, lineHeight: 1.8 }}>
            <strong>To enable preview:</strong><br /><br />
            Place <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>medical-examination-form.pdf</code><br />
            in your <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>public/</code> folder.
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ borderRadius: 4, display: "block", cursor: "pointer" }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: t.bg }}>
      <NavBar title="Medical Examination Form" sub="Click a field in the preview to jump to it" onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: isMobile ? "none" : "0 0 42%", minWidth: isMobile ? "none" : 380, maxWidth: isMobile ? "none" : 520, borderRight: isMobile ? "none" : `1px solid ${t.divider}`, display: "flex", flexDirection: "column", overflowY: isMobile ? "visible" : "auto" }}>
          {formPanel}
        </div>
        <div style={{ flex: 1, height: isMobile ? "60vw" : "100%", minHeight: isMobile ? 280 : 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {previewPanel}
        </div>
      </div>
    </div>
  );
}