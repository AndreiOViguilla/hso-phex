import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Btn } from "../components/UI";

const EMPTY_FORM = {
  name:          "",
  idNo:          "",
};

function buildFieldMap(f) {
  return {
    "Name":   f.name,
    "ID No":  f.idNo,
  };
}

export default function DEFPage({ prefillId, prefillName, onBack, onSuccess }) {
  const isMobile    = useIsMobile();
  const canvasRef   = useRef(null);
  const pdfDocRef   = useRef(null);
  const pdfBytesRef = useRef(null);
  const renderTimeout = useRef(null);

  const [pdfReady,    setPdfReady]    = useState(false);
  const [pdfError,    setPdfError]    = useState(false);
  const [rendering,   setRendering]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    idNo: prefillId   || "",
    name: prefillName || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Always sync when prefill props change (DB arrives async)
  useEffect(() => {
    setForm(f => ({
      ...f,
      idNo: prefillId   || f.idNo,
      name: prefillName || f.name,  // "Andrei O. Viguilla"
    }));
  }, [prefillId, prefillName]);

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
      } catch (e) {
        setPdfError(true);
      }
    };
    load();
  }, []);

  // Render preview
  const renderPreview = useCallback(async (f) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(1);
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const previewPanel = container ? container.parentElement : null;
      const dpr = window.devicePixelRatio || 1;
      const availableWidth = (previewPanel ? previewPanel.clientWidth : container ? container.clientWidth : 700) - 24;
      const fitWidth = Math.max(availableWidth, 280);
      const pdfNatural = page.getViewport({ scale: 1 });
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      const viewport = page.getViewport({ scale: renderScale });

      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width  = `${fitWidth}px`;
      canvas.style.height = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = "0 auto";

      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const s = renderScale;

      // AcroForm field positions from pymupdf
      // Name: x=59 y=107, ID No: x=61 y=123
      const drawText = (text, x, y, size = 8) => {
        if (!text) return;
        ctx.font = `${size * s}px Arial`;
        ctx.fillStyle = "#1a56db";
        ctx.save();
        ctx.fillText(String(text), (x + 1) * s, (y + size) * s);
        ctx.restore();
      };

      // Highlight fields
      const highlight = (x, y, w, h, value) => {
        ctx.fillStyle = value ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.06)";
        ctx.fillRect(x * s, y * s, w * s, h * s);
        ctx.strokeStyle = value ? "#3b82f6" : "rgba(59,130,246,0.4)";
        ctx.lineWidth = value ? 1.5 * s : 0.8 * s;
        ctx.strokeRect(x * s, y * s, w * s, h * s);
      };

      highlight(59, 107, 95, 15, f.name);
      highlight(61, 123, 95, 15, f.idNo);
      drawText(f.name,  60, 107);
      drawText(f.idNo,  62, 123);

    } catch (e) {
      console.error("Render error:", e);
    }
    setRendering(false);
  }, []);

  useEffect(() => {
    if (!pdfReady) return;
    clearTimeout(renderTimeout.current);
    renderTimeout.current = setTimeout(() => renderPreview(form), 300);
    return () => clearTimeout(renderTimeout.current);
  }, [form, pdfReady, renderPreview]);

  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => {
      clearTimeout(renderTimeout.current);
      renderTimeout.current = setTimeout(() => renderPreview(form), 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, form, renderPreview]);

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
      const { PDFDocument } = window.PDFLib;
      const pdfDoc  = await PDFDocument.load(pdfBytesRef.current.slice(0), { ignoreEncryption: true });
      const pdfForm = pdfDoc.getForm();
      const fieldMap = buildFieldMap(form);

      for (const [name, value] of Object.entries(fieldMap)) {
        try { pdfForm.getTextField(name).setText(value || ""); } catch (_) {}
      }

      try { pdfForm.flatten(); } catch (_) {}

      const bytes = await pdfDoc.save({ updateFieldAppearances: false });
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `DEF_${form.idNo || "student"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onSuccess();
    } catch (e) {
      alert("Download failed: " + e.message);
    }
    setDownloading(false);
  };

  const inp = (extra) => ({
    padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box", ...extra,
  });
  const lbl = { fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 };
  const sec = { fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1.5px solid #e5e7eb", paddingBottom: 8, marginBottom: 14 };
  const c2  = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginBottom: 12 };

  const formPanel = (
    <div style={{ overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", flex: 1 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={sec}>Student information</div>
        <div style={c2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lbl}>Full name</label>
            <input style={inp()} placeholder="Juan A. Dela Cruz" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lbl}>ID number</label>
            <input style={inp()} placeholder="12512345" value={form.idNo} onChange={e => set("idNo", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Info notice — rest is filled by dentist */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>Dentist-filled section</div>
        <div style={{ fontSize: 12, color: "#0369a1", lineHeight: 1.7 }}>
          The rest of the Dental Examination Form — including General Condition checkboxes, the tooth chart, and Other Remarks — is completed by your <strong>assigned dentist</strong> during the examination. You only need to provide your name and ID number above.
        </div>
      </div>

      {/* What to bring */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>What to bring</div>
        {[
          "This printed DEF form (or show this screen)",
          "Your student ID",
          "Your PHEx appointment confirmation",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1d4ed8", marginTop: 5, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#374151" }}>{item}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
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
      <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db" }}>Live PDF preview</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {rendering  && <span style={{ fontSize: 11, color: "#9ca3af" }}>Updating…</span>}
          {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading…</span>}
          {pdfError   && <span style={{ fontSize: 11, color: "#fca5a5" }}>dental-form.pdf not found in /public</span>}
          {pdfReady   && !rendering && <span style={{ fontSize: 11, color: "#6ee7b7" }}>AcroForm ready</span>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {pdfError ? (
          <div style={{ color: "#d1d5db", fontSize: 13, padding: 20, lineHeight: 1.8 }}>
            Place <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>dental-form.pdf</code> in your <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>public/</code> folder.
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ borderRadius: 4, display: "block" }} />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <NavBar title="Dental Examination Form" sub="Fill left · See changes live on the right" onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: isMobile ? "none" : "0 0 42%", minWidth: isMobile ? "none" : 380, maxWidth: isMobile ? "none" : 520, borderRight: isMobile ? "none" : "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflowY: isMobile ? "visible" : "auto" }}>
          {formPanel}
        </div>
        <div style={{ flex: 1, position: isMobile ? "relative" : "sticky", top: 0, height: isMobile ? "60vw" : "100%", minHeight: isMobile ? 280 : 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {previewPanel}
        </div>
      </div>
    </div>
  );
}