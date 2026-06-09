import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";

const EMPTY_FORM = {
  name: "",
  idNo: "",
};

function buildFieldMap(f) {
  return {
    "Name":  f.name,
    "ID No": f.idNo,
  };
}

const FIELD_TO_INPUT_ID = {
  "Name":  "def-name",
  "ID No": "def-idNo",
};

const INPUT_ID_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_INPUT_ID).map(([k, v]) => [v, k])
);

const DEF_FIELDS = [
  { name: "Name",  x: 59, y: 107, w: 95, h: 15 },
  { name: "ID No", x: 61, y: 123, w: 95, h: 15 },
];

export default function DEFPage({ prefillId, prefillName, onBack, onSuccess }) {
  const isMobile      = useIsMobile();
  const { dark, toggle, t } = useTheme();
  const canvasRef     = useRef(null);
  const pdfDocRef     = useRef(null);
  const pdfBytesRef   = useRef(null);
  const offscreenRef  = useRef(null);
  const renderTimeout = useRef(null);
  const scaleRef      = useRef(1);

  const [pdfReady,    setPdfReady]    = useState(false);
  const [pdfError,    setPdfError]    = useState(false);
  const [rendering,   setRendering]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [zoom, setZoom] = useState(1.0);

  const [form, setForm] = useState({ ...EMPTY_FORM, idNo: prefillId || "", name: prefillName || "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Fetch fresh from backend on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/students/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) return;
        setForm(f => ({
          ...f,
          idNo: user.studentId || f.idNo,
          name: [user.firstName, user.middleInitial, user.lastName].filter(Boolean).join(" ") || f.name,
        }));
      })
      .catch(() => {});
  }, []);

  // Load pdf.js + PDF
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
        const resp = await fetch("/dental-form.pdf");
        if (!resp.ok) throw new Error("not found");
        const buf = await resp.arrayBuffer();
        pdfBytesRef.current = buf.slice(0);
        pdfDocRef.current = await window.pdfjsLib.getDocument({ data: buf }).promise;
        setPdfReady(true);
      } catch (e) { setPdfError(true); }
    };
    load();
  }, []);

  // Canvas click → focus matching input
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cssW = parseFloat(canvas.style.width) || rect.width;
    const cssH = parseFloat(canvas.style.height) || rect.height;
    const pdfW = canvas.width / scaleRef.current;
    const pdfH = canvas.height / scaleRef.current;
    const px = (cx / cssW) * pdfW;
    const py = (cy / cssH) * pdfH;

    const hit = DEF_FIELDS.find(f => px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h);
    if (hit) {
      setHighlighted(hit.name);
      const el = document.getElementById(FIELD_TO_INPUT_ID[hit.name]);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { el.focus(); el.select?.(); }, 300);
      }
    }
  }, []);

  // Draw overlay on canvas
  const drawOverlay = useCallback((ctx, f, hl, s) => {
    const fm = buildFieldMap(f);
    DEF_FIELDS.forEach(({ name, x, y, w, h }) => {
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
        ctx.fillText(String(value), (x + 1.5) * s, (y + h - 3) * s);
        ctx.restore();
      }
    });
  }, []);

  // Composite: copy offscreen PDF + overlay
  const composite = useCallback((f, hl) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0);
    drawOverlay(ctx, f, hl, scaleRef.current);
  }, [drawOverlay]);

  // Full render: PDF to offscreen, then composite
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
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = zoomLevel <= 1 ? "0 auto" : "0";
      canvas.style.cursor  = "pointer";

      const off = document.createElement("canvas");
      off.width  = viewport.width;
      off.height = viewport.height;
      offscreenRef.current = off;
      await page.render({ canvasContext: off.getContext("2d"), viewport }).promise;

      composite(f, hl);
    } catch (e) { console.error("Render error:", e); }
    setRendering(false);
  }, [composite, zoom]);

  useEffect(() => {
    if (!pdfReady) return;
    clearTimeout(renderTimeout.current);
    const currentForm = form;
    const currentHighlighted = highlighted;
    const currentZoom = zoom;
    renderTimeout.current = setTimeout(async () => {
      const page = await pdfDocRef.current?.getPage(1);
      const canvas = canvasRef.current;
      if (!page || !canvas) return;
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const previewPanel = container?.parentElement;
      const panelW = (previewPanel ? previewPanel.clientWidth : 700) - 24;
      const pdfNatural = page.getViewport({ scale: 1 });
      const baseWidth = Math.max(panelW, 280);
      const fitWidth = baseWidth * currentZoom;
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      scaleRef.current = renderScale;
      const viewport = page.getViewport({ scale: renderScale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = currentZoom <= 1 ? "0 auto" : "0";
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

  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => {
      clearTimeout(renderTimeout.current);
      renderTimeout.current = setTimeout(() => renderPreview(form, highlighted), 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, form, renderPreview, zoom]);

  // Highlight change — composite only, no flash
  useEffect(() => {
    if (!pdfReady) return;
    composite(form, highlighted);
  }, [highlighted, pdfReady, composite, form]);

  // Download
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
      const { PDFDocument, rgb, StandardFonts, PDFName, PDFDict } = window.PDFLib;

      // Load a fresh copy
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current.slice(0), { ignoreEncryption: true });
      const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages  = pdfDoc.getPages();
      const page   = pages[0];
      const { height } = page.getSize();

      // Nuke the AcroForm entirely so no field appearances remain
      try {
        pdfDoc.catalog.delete(PDFName.of("AcroForm"));
      } catch (_) {}

      // Also remove widget annotations from the page (the actual field boxes)
      try {
        const annots = page.node.get(PDFName.of("Annots"));
        if (annots) page.node.delete(PDFName.of("Annots"));
      } catch (_) {}

      // Draw text directly onto the page — pure black
      const DEF_DRAW = [
        { x: 60.5, yTop: 109, value: form.name },
        { x: 62.5, yTop: 125, value: form.idNo },
      ];

      DEF_DRAW.forEach(({ x, yTop, value }) => {
        if (!value) return;
        page.drawText(String(value), {
          x,
          y: height - yTop,
          size: 9,
          font,
          color: rgb(0, 0, 0),
          maxWidth: 90,
        });
      });

      const bytes = await pdfDoc.save();
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = `DEF_${form.idNo || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      onSuccess();
    } catch (e) { alert("Download failed: " + e.message); }
    setDownloading(false);
  };

  const inp = (extra) => ({
    padding: "9px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box", background: t.input, color: t.text, ...extra,
  });
  const lbl = { fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 };
  const sec = { fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1.5px solid ${t.divider}`, paddingBottom: 8, marginBottom: 14 };
  const c2  = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginBottom: 12 };

  const formPanel = (
    <div style={{ overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", flex: 1, background: t.bg }}>
      <div style={{ marginBottom: 22 }}>
        <div style={sec}>Student information</div>
        <div style={c2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lbl}>Full name</label>
            <input
              id="def-name"
              style={inp()}
              placeholder="Juan A. Dela Cruz"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              onFocus={() => setHighlighted("Name")}
              onBlur={() => setHighlighted(null)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lbl}>ID number</label>
            <input
              id="def-idNo"
              style={inp()}
              placeholder="12512345"
              value={form.idNo}
              onChange={e => set("idNo", e.target.value)}
              onFocus={() => setHighlighted("ID No")}
              onBlur={() => setHighlighted(null)}
            />
          </div>
        </div>
      </div>

      <div style={{ background: t.blueBg, border: `1px solid ${t.blue}44`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.blueText, marginBottom: 6 }}>Dentist-filled section</div>
        <div style={{ fontSize: 12, color: t.blueText, lineHeight: 1.7 }}>
          The rest of the Dental Examination Form — including General Condition checkboxes, the tooth chart, and Other Remarks — is completed by your <strong>assigned dentist</strong> during the examination. You only need to provide your name and ID number above.
        </div>
      </div>

      <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>What to bring</div>
        {["This printed DEF form (or show this screen)", "Your student ID", "Your PHEx appointment confirmation"].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.accent, marginTop: 5, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: t.textSub }}>{item}</div>
          </div>
        ))}
      </div>

      <div style={{ background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: t.orangeText, lineHeight: 1.7 }}>
        Dental examination is part of the on-site PHEx. If using an accredited clinic, bring this DEF along with the MEF and request X-ray with dental exam.
      </div>

      <Btn variant="primary" onClick={handleDownload} style={{ opacity: downloading ? 0.7 : 1 }}>
        {downloading ? "Generating PDF…" : "Generate & download DEF PDF →"}
      </Btn>
      <div style={{ height: 20 }} />
    </div>
  );

  const previewPanel = (
    <div style={{ background: "#374151", display: "flex", flexDirection: "column", flex: 1, minHeight: 320, overflow: "hidden" }}>
      <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {highlighted && <span style={{ fontSize: 11, color: "#93c5fd" }}>↑ {highlighted}</span>}
          {rendering   && <span style={{ fontSize: 11, color: t.textMuted }}>Updating…</span>}
          {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: t.textMuted }}>Loading…</span>}
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
            Place <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>dental-form.pdf</code> in your <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>public/</code> folder.
          </div>
        ) : (
          <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ borderRadius: 4, display: "block", cursor: "pointer" }} />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: t.bg }}>
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Dental Examination Form</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Click a field in the preview to jump to it</div>
        </div>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
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