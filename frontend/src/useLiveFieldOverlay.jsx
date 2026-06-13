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

        // Pragmatic fixed size: the MEF template's actual rendered field
        // text (in the flattened download) is consistently small relative
        // to its box — formula-derived sizes were overshooting. Use a
        // small fixed PDF-point size, scaled to the preview's fit scale.
        // Tune BASE_FONT_SIZE_PT directly if it still doesn't match.
        const BASE_FONT_SIZE_PT = 1;
        const effectivePdfFontSize = pdfFontSize > 0 ? pdfFontSize : BASE_FONT_SIZE_PT;

        // Convert from PDF point size to on-screen CSS pixels at the
        // current fit scale — matches how the canvas is rendered.
        const fontSize = effectivePdfFontSize * fitScale;

        next[ann.fieldName] = {
          x, y, width, height,
          type: ann.fieldType || "Tx", // 'Tx' text, 'Btn' checkbox/radio
          multiline: !!ann.multiLine,
          fontSize,
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
        zIndex: 5, // sits above the canvas + pdf.js annotation layer
      }}
    >
      {Object.entries(fieldRects).map(([fieldName, rect]) => {
        const value = values?.[fieldName];
        if (value === undefined || value === null || value === "") return null;

        const isCheckbox = rect.type === "Btn";

        if (isCheckbox) {
          // Only render a mark if the field is actually checked/true.
          if (!value) return null;
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

        // Text field: use the same font size pdf-lib would render at in the
        // flattened download, scaled to the current preview's fit scale.
        let fontSize = Math.max(6, rect.fontSize || 12) * fontScale;

        // pdf-lib shrinks auto-size text to fit the field's width if it
        // would otherwise overflow. Roughly replicate that here using a
        // simple average-character-width estimate (Helvetica ~0.5 * fontSize
        // per character), so long values don't visually overflow the field
        // in the overlay either.
        const text = String(value);
        if (!rect.multiline && text.length > 0) {
          const estCharWidth = fontSize * 0.5;
          const estTextWidth = text.length * estCharWidth;
          const maxWidth = rect.width - 4;
          if (estTextWidth > maxWidth && maxWidth > 0) {
            fontSize = fontSize * (maxWidth / estTextWidth);
            fontSize = Math.max(6, fontSize);
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
              width: rect.width - 4,
              height: rect.height,
              display: "flex",
              alignItems: "center",
              fontSize,
              lineHeight: 1.1,
              color: "#111827",
              fontFamily: "Helvetica, Arial, sans-serif",
              whiteSpace: rect.multiline ? "pre-wrap" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {String(value)}
          </div>
        );
      })}
    </div>
  );
}