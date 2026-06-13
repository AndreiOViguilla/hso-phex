import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { getFieldOwner } from "../mefFieldOwnership";
import { renderFieldOwnerTooltips } from "../fieldOwnerTooltips";
import LiveFieldOverlay, { useLiveFieldOverlay } from "../useLiveFieldOverlay";

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

const INPUT_ID_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_INPUT_ID).map(([k, v]) => [v, k])
);

export default function MEFPage({ prefillId, prefillFirstName, prefillLastName, prefillMI, prefillGender, onBack, onSuccess }) {
  const isMobile    = useIsMobile();
  const { dark, toggle, t } = useTheme();
  const { show }    = useModal();
  const canvasRef   = useRef(null);
  const pdfDocRef   = useRef(null);
  const renderTimeout = useRef(null);
  const scaleRef    = useRef(1);
  const requestIdRef = useRef(0);

  const [pdfReady,    setPdfReady]    = useState(false);
  const [pdfError,    setPdfError]    = useState(false);
  const [rendering,   setRendering]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded,  setDownloaded]  = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [pdfVersion, setPdfVersion] = useState(0);
  const [overlayDims, setOverlayDims] = useState({ width: 0, height: 0 });
  const { fieldRects, captureFieldRects } = useLiveFieldOverlay();

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

  useEffect(() => {
    fetch("/api/students/me", { credentials: "include" })
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

  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimer = useRef(null);

  // Auto-save form to localStorage on every change
  useEffect(() => {
    localStorage.setItem("mef_draft", JSON.stringify(form));
    setDraftSaved(true);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => setDraftSaved(false), 1500);
  }, [form]);

  // Restore draft from localStorage on mount (before backend fetch overwrites)
  useEffect(() => {
    try {
      const draft = localStorage.getItem("mef_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        setForm(f => ({ ...f, ...parsed }));
      }
    } catch (_) {}
  }, []);

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
  const tooltipLayerRef    = useRef(null);

  // Fetch the live-filled, non-flattened PDF preview from the backend
  const loadFilledPdf = useCallback(async () => {
    if (!window.pdfjsLib) return;
    const reqId = ++requestIdRef.current;
    setRendering(true);
    try {
      const resp = await fetch("/api/forms/mef/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error("not found");
      const buf = await resp.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;

      if (reqId !== requestIdRef.current) return; // stale response, ignore

      pdfDocRef.current = doc;
      setPdfReady(true);
      setPdfError(false);
      setPdfVersion(v => v + 1);
    } catch (e) {
      if (reqId === requestIdRef.current) setPdfError(true);
    }
    if (reqId === requestIdRef.current) setRendering(false);
  }, [form]);

  // Re-fetch the filled PDF shortly after form settles (debounced so rapid
  // typing doesn't fire a request per keystroke; UI state and the
  // LiveFieldOverlay are still instant since they're separate from this fetch).
  useEffect(() => {
    const timer = setTimeout(() => { loadFilledPdf(); }, 350);
    return () => clearTimeout(timer);
  }, [form, loadFilledPdf]);

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

      const fitHeight = pdfNatural.height * fitScale;
      const cssViewport = page.getViewport({ scale: fitScale });

      setOverlayDims({ width: fitWidth, height: fitHeight });
      await captureFieldRects(page, cssViewport, fitScale);
      console.log("[MEFPage-debug] captured field rects, count:", Object.keys(fieldRects).length);

      // AcroForm annotation layer (renders actual field widgets/values)
      const annotationDiv = annotationLayerRef.current;
      if (annotationDiv && window.pdfjsViewer) {
        annotationDiv.innerHTML = "";
        annotationDiv.style.width  = `${fitWidth}px`;
        annotationDiv.style.height = `${fitHeight}px`;
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
          // Also make widget text transparent — LiveFieldOverlay now renders
          // the visible text/checkmarks, so showing both would double up.
          annotationDiv.querySelectorAll("input, textarea, select, section")
            .forEach(el => {
              el.style.pointerEvents = "none";
              el.style.color = "transparent";
              el.style.caretColor = "transparent";
            });
        } catch (_) {}
      }

      // Hover tooltips: "Filled up by Student" / "Filled up by Nurse"
      const tooltipDiv = tooltipLayerRef.current;
      if (tooltipDiv) {
        await renderFieldOwnerTooltips({
          page,
          cssViewport,
          container: tooltipDiv,
          fitWidth,
          fitHeight,
          getFieldOwner,
        });
      }
    } catch (e) { console.error("Render error:", e); }
    setRendering(false);
  }, [zoom, captureFieldRects]);

  useEffect(() => {
    if (!pdfReady) return;
    renderPreview();
  }, [pdfReady, pdfVersion, zoom, renderPreview]);

  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => renderPreview();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, renderPreview]);

  const handleDownload = async () => {
    // Validate — every field must be filled
    const missing = [];
    if (!form.idNumber)         missing.push("ID number");
    if (!form.lastName)         missing.push("Last name");
    if (!form.firstName)        missing.push("First name");
    if (!form.gender)           missing.push("Gender");
    if (!form.birthday)         missing.push("Birthday");
    if (!form.contact)          missing.push("Contact number");
    if (!form.college)          missing.push("College / Section");
    if (!form.academicYear)     missing.push("Academic year");
    if (!form.emergencyName)    missing.push("Emergency contact name");
    if (!form.emergencyRel)     missing.push("Relationship");
    if (!form.emergencyContact) missing.push("Emergency contact number");
    if (!form.studentNameAuth)  missing.push("Authority full name");
    if (!form.studentAge)       missing.push("Age");

    if (missing.length > 0) {
      show({ type: "error", title: "Incomplete form", message: `Please fill in all required fields: ${missing.join(", ")}.` });
      return;
    }

    setDownloading(true);
    try {
      const resp = await fetch("/api/forms/mef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate PDF");
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `MEF_${form.idNumber || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (e) {
      show({ type: "error", title: "Download failed", message: e.message });
    }
    setDownloading(false);
  };

  const inp = (extra) => ({
    padding: "9px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box",
    background: t.input, color: t.text,
    colorScheme: dark ? "dark" : "light",
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
        {downloading ? "Generating PDF…" : downloaded ? "Re-download MEF PDF" : "Generate & download MEF PDF →"}
      </Btn>

      <button onClick={() => {
        // Validate before marking complete
        const missing = [];
        if (!form.idNumber)         missing.push("ID number");
        if (!form.lastName)         missing.push("Last name");
        if (!form.firstName)        missing.push("First name");
        if (!form.gender)           missing.push("Gender");
        if (!form.birthday)         missing.push("Birthday");
        if (!form.contact)          missing.push("Contact number");
        if (!form.college)          missing.push("College / Section");
        if (!form.academicYear)     missing.push("Academic year");
        if (!form.emergencyName)    missing.push("Emergency contact name");
        if (!form.emergencyRel)     missing.push("Relationship");
        if (!form.emergencyContact) missing.push("Emergency contact number");
        if (!form.studentNameAuth)  missing.push("Authority full name");
        if (!form.studentAge)       missing.push("Age");
        if (missing.length > 0) {
          show({ type: "error", title: "Incomplete form", message: `Please fill in all required fields: ${missing.join(", ")}.` });
          return;
        }
        if (!downloaded) {
          show({ type: "error", title: "Download required", message: "Please generate and download the MEF PDF first before marking it as complete." });
          return;
        }
        localStorage.removeItem("mef_draft");
        onSuccess();
      }} style={{ width: "100%", marginTop: 10, padding: "13px", background: t.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Mark MEF as complete
      </button>
      <div style={{ height: 20 }} />
    </div>
  );

  const previewPanel = (
    <div style={{ background: "#374151", display: "flex", flexDirection: "column", flex: 1, minHeight: 320, overflow: "hidden", position: "relative" }}>
      <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rendering   && <span style={{ fontSize: 11, color: t.textMuted }}>Updating…</span>}
          {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: t.textMuted }}>Loading…</span>}
          {pdfError    && <span style={{ fontSize: 11, color: "#fca5a5" }}>PDF not found</span>}
          {pdfReady && !rendering && <span style={{ fontSize: 11, color: "#6ee7b7" }}>Hover a field to see who fills it →</span>}
        </div>
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
            <strong>Preview unavailable</strong><br /><br />
            Make sure <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>backend/public/medical-examination-form.pdf</code> exists on the server.
          </div>
        ) : (
          <div style={{ position: "relative", display: "inline-block" }}>
            <canvas ref={canvasRef} style={{ borderRadius: 4, display: "block" }} />
            <div ref={annotationLayerRef} className="annotationLayer" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
            <LiveFieldOverlay
              fieldRects={fieldRects}
              values={buildFieldMap(form)}
              fitWidth={overlayDims.width}
              fitHeight={overlayDims.height}
            />
            <div ref={tooltipLayerRef} style={{ position: "absolute", top: 0, left: 0 }} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: t.bg }}>
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Medical Examination Form</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Click a field in the preview to jump to it</div>
        </div>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>
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