// Renders transparent hover-tooltip overlays on top of a pdf.js-rendered
// page, one per AcroForm field, showing "Filled up by Student/Nurse".
//
// Usage (inside your render function, after rendering canvas + annotation layer):
//
//   await renderFieldOwnerTooltips({
//     page,
//     cssViewport,        // page.getViewport({ scale: fitScale })
//     container: tooltipLayerRef.current,
//     fitWidth,
//     fitHeight: pdfNatural.height * fitScale,
//     getFieldOwner,      // (fieldName) => "Student" | "Nurse"
//   });

export async function renderFieldOwnerTooltips({ page, cssViewport, container, fitWidth, fitHeight, getFieldOwner }) {
  if (!container) return;
  container.innerHTML = "";
  container.style.width  = `${fitWidth}px`;
  container.style.height = `${fitHeight}px`;
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.pointerEvents = "none"; // children opt back in individually

  let annotations;
  try {
    annotations = await page.getAnnotations({ intent: "display" });
  } catch (_) {
    return;
  }

  annotations.forEach(ann => {
    const fieldName = ann.fieldName;
    if (!fieldName || !ann.rect) return;

    const owner = getFieldOwner(fieldName);

    const [x1, y1, x2, y2] = ann.rect;
    const topLeft     = cssViewport.convertToViewportPoint(x1, y2);
    const bottomRight = cssViewport.convertToViewportPoint(x2, y1);

    const left   = Math.min(topLeft[0], bottomRight[0]);
    const top    = Math.min(topLeft[1], bottomRight[1]);
    const width  = Math.abs(bottomRight[0] - topLeft[0]);
    const height = Math.abs(bottomRight[1] - topLeft[1]);

    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left   = `${left}px`;
    el.style.top    = `${top}px`;
    el.style.width  = `${width}px`;
    el.style.height = `${height}px`;
    el.style.pointerEvents = "auto";
    el.style.cursor = "default";
    el.style.transition = "background-color 0.1s, outline-color 0.1s";
    el.style.outline = "1px solid transparent";
    el.title = `Filled up by ${owner}`;

    const hoverColor    = owner === "Student" ? "rgba(59,130,246,0.18)" : "rgba(217,119,6,0.18)";
    const outlineColor  = owner === "Student" ? "#3b82f6" : "#d97706";

    el.addEventListener("mouseenter", () => {
      el.style.backgroundColor = hoverColor;
      el.style.outline = `1.5px solid ${outlineColor}`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.backgroundColor = "transparent";
      el.style.outline = "1px solid transparent";
    });

    container.appendChild(el);
  });
}
