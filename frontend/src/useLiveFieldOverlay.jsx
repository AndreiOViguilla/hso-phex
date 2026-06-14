import { useState, useCallback } from "react";

/**
 * useLiveFieldOverlay
 * --------------------
 * Extracts AcroForm field positions (rects) from a loaded pdf.js page once,
 * then lets you render a transparent HTML overlay showing the *current*
 * in-memory form values at those exact positions — instantly, with zero
 * network round trip. The real PDF (fetched from the server) can lag behind
 * by a few hundred ms; the user never sees that lag because this overlay
 * already shows what they typed.
 *
 * Usage:
 *   const { fieldRects, captureFieldRects } = useLiveFieldOverlay();
 *
 *   // after pdfDocRef.current is loaded and you know cssViewport/fitScale:
 *   await captureFieldRects(page, cssViewport);
 *
 *   // render:
 *   <LiveFieldOverlay
 *     fieldRects={fieldRects}
 *     values={{ ...form, ...checks }}        // current in-memory state
 *     fitWidth={fitWidth}
 *     fitHeight={fitHeight}
 *   />
 */
export function useLiveFieldOverlay() {
  // fieldRects: { [pdfFieldName]: { x, y, width, height, type } }
  // x/y/width/height are in *CSS pixel* space relative to the canvas,
  // already flipped to top-left origin.
  const [fieldRects, setFieldRects] = useState({});

  const captureFieldRects = useCallback(async (page, cssViewport, fitScale = 1) => {
    try {
      const annotations = await page.getAnnotations({ intent: "display" });
      const next = {};

      for (const ann of annotations) {
        if (!ann.fieldName || !ann.rect) continue;

        // ann.rect = [x1, y1, x2, y2] in PDF user space (origin bottom-left).
        // viewport.convertToViewportRectangle gives us [x1, y1, x2, y2] in
        // CSS pixel space with origin top-left, already accounting for the
        // page rotation/scale.
        const [vx1, vy1, vx2, vy2] = cssViewport.convertToViewportRectangle(ann.rect);

        const x = Math.min(vx1, vx2);
        const y = Math.min(vy1, vy2);
        const width = Math.abs(vx2 - vx1);
        const height = Math.abs(vy2 - vy1);

        // Extract the field's font size from its default appearance (/DA),
        // e.g. "/Helv 10 Tf 0 g" -> 10. This is the same size pdf-lib uses
        // when it draws the value into the flattened download PDF, so using
        // it here (scaled by fitScale, same as the canvas render scale)
        // keeps the live overlay text visually consistent with the download.
        let pdfFontSize = 0; // 0 = "auto-size to fit" in PDF spec terms
        const da = ann.defaultAppearanceData?.fontSize ?? null;
        if (typeof da === "number") {
          pdfFontSize = da;
        } else if (typeof ann.defaultAppearance === "string") {
          const m = ann.defaultAppearance.match(/\/\S+\s+([\d.]+)\s+Tf/);
          if (m) pdfFontSize = parseFloat(m[1]);
        }

        // A /DA font size of 0 means "auto-size". pdf-lib defaults to 12pt
        // for auto-size fields, shrinking to fit if the field's box is
        // shorter than that. Cap by height so short single-line fields
        // don't render oversized text.
        const PDF_LIB_DEFAULT_AUTO_FONT_SIZE = 12;
        const heightPdfUnits = height / fitScale;
        const heightCappedSize = Math.max(4, heightPdfUnits - 2);
        const effectivePdfFontSize = pdfFontSize > 0
          ? pdfFontSize
          : Math.min(PDF_LIB_DEFAULT_AUTO_FONT_SIZE, heightCappedSize);

        // Convert from PDF point size to on-screen CSS pixels at the
        // current fit scale — matches how the canvas is rendered.
        // Render at a fixed, comfortably-sized base font, then visually
        // shrink with a CSS transform scale. Browsers enforce a minimum
        // *font-size* (often ~9-12px) regardless of the computed value,
        // but transform: scale() is NOT subject to that floor, so this is
        // the only reliable way to render genuinely small text.
        const BASE_RENDER_PX = 16; // arbitrary comfortable base size
        const desiredPx = effectivePdfFontSize * fitScale;
        const scale = desiredPx / BASE_RENDER_PX;
        next[ann.fieldName] = {
          x, y, width, height,
          type: ann.fieldType || "Tx", // 'Tx' text, 'Btn' checkbox/radio
          multiline: !!ann.multiLine,
          scale,
        };
      }

      setFieldRects(next);
    } catch (_) {
      // If annotations can't be read, overlay simply won't render anything —
      // the underlying PDF preview still works as before.
      setFieldRects({});
    }
  }, []);

  return { fieldRects, captureFieldRects };
}

/**
 * LiveFieldOverlay
 * -----------------
 * Renders a transparent absolutely-positioned div the same size as the
 * canvas, with one small label per known field showing its current value.
 * Checkbox/radio fields show a checkmark when truthy.
 *
 * `values` should be a flat map of PDF field name -> current value, e.g.
 * `{ ...form, ...checks }`.
 */
export default function LiveFieldOverlay({ fieldRects, values, fitWidth, fitHeight, fontScale = 1 }) {
  if (!fieldRects || Object.keys(fieldRects).length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: fitWidth,
        height: fitHeight,
        pointerEvents: "none",
        zIndex: 5, // above annotation layer (3) but below tooltip layer (6); pointerEvents none passes clicks through to annotation checkboxes
      }}
    >
      {Object.entries(fieldRects).map(([fieldName, rect]) => {
        const value = values?.[fieldName];
        if (value === undefined || value === null || value === "") return null;

        const isCheckbox = rect.type === "Btn";

        if (isCheckbox) {
          // PDF checkbox values can be booleans (true/false) or AcroForm
          // export-value strings ("Yes"/"Off", "Yes"/"No"). Normalize so
          // "Off"/"No"/false/"" all mean unchecked.
          const isChecked = value === true || value === "Yes" || value === "On";
          if (!isChecked) return null;
          const size = Math.min(rect.width, rect.height);
          return (
            <div
              key={fieldName}
              style={{
                position: "absolute",
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#111827",
                fontSize: size * 0.8,
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: "Helvetica, Arial, sans-serif",
              }}
            >
              ✓
            </div>
          );
        }

        // Text field: render at a fixed base size, then visually scale down
        // via CSS transform — bypasses the browser's minimum-font-size
        // floor that clamps small `font-size` values.
        const BASE_RENDER_PX = 16;
        let scale = rect.scale || 1;

        // pdf-lib shrinks auto-size text to fit the field's width if it
        // would otherwise overflow. Roughly replicate that here using a
        // simple average-character-width estimate (Helvetica ~0.5 * fontSize
        // per character at the BASE_RENDER_PX size), so long values don't
        // visually overflow the field in the overlay either.
        const text = String(value);
        if (!rect.multiline && text.length > 0) {
          const renderedFontSize = BASE_RENDER_PX * scale;
          const estCharWidth = renderedFontSize * 0.5;
          const estTextWidth = text.length * estCharWidth;
          const maxWidth = rect.width - 4;
          if (estTextWidth > maxWidth && maxWidth > 0) {
            scale = scale * (maxWidth / estTextWidth);
          }
        }

        return (
          <div
            key={fieldName}
            title={String(value)}
            style={{
              position: "absolute",
              left: rect.x + 2,
              top: rect.y,
              width: (rect.width - 4) / scale,
              height: rect.height / scale,
              display: "flex",
              alignItems: "center",
              fontSize: BASE_RENDER_PX,
              lineHeight: 1.1,
              color: "#111827",
              fontFamily: "Helvetica, Arial, sans-serif",
              whiteSpace: rect.multiline ? "pre-wrap" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {String(value)}
          </div>
        );
      })}
    </div>
  );
}