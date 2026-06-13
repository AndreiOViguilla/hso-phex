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

  const captureFieldRects = useCallback(async (page, cssViewport) => {
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

        next[ann.fieldName] = {
          x, y, width, height,
          type: ann.fieldType || "Tx", // 'Tx' text, 'Btn' checkbox/radio
          multiline: !!ann.multiLine,
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

        // Text field: show the value, roughly matching PDF text size.
        const fontSize = Math.max(8, Math.min(rect.height * 0.7, 14)) * fontScale;

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
