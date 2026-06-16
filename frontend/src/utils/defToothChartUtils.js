import { CHECKBOX_FIELD_MAP, QUADRANTS, ROW_LABELS } from "./defToothChart";

// Convert flat { Checkbox_1: true, Checkbox_2: false, ... }
// to structured { upperRight: { WithCaries: [f,f,f,f,f,f,f,f], ... }, ... }
export function flatToStructured(checks) {
  const result = {};
  for (const q of QUADRANTS) {
    result[q] = {};
    for (const row of ROW_LABELS) {
      result[q][row] = Array(8).fill(false);
    }
  }
  for (const [fieldName, info] of Object.entries(CHECKBOX_FIELD_MAP)) {
    const { quadrant, row, tooth } = info;
    result[quadrant][row][tooth - 1] = !!checks[fieldName];
  }
  return result;
}

// Convert structured back to flat { Checkbox_N: true/false, ... }
export function structuredToFlat(toothChart) {
  const result = {};
  for (const [fieldName, info] of Object.entries(CHECKBOX_FIELD_MAP)) {
    const { quadrant, row, tooth } = info;
    result[fieldName] = !!(toothChart?.[quadrant]?.[row]?.[tooth - 1]);
  }
  return result;
}

// Empty structured tooth chart
export function emptyToothChart() {
  const result = {};
  for (const q of QUADRANTS) {
    result[q] = {};
    for (const row of ROW_LABELS) {
      result[q][row] = Array(8).fill(false);
    }
  }
  return result;
}
