/**
 * migrateDEF.js
 * One-time migration: converts all DEF form documents from flat Checkbox_N
 * format to the structured toothChart nested format in MongoDB.
 *
 * Run once on your server:
 *   node migrateDEF.js
 *
 * Place this file in your backend/ folder alongside server.js.
 * Make sure your .env / environment variables are available.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Form = require("./src/models/Form"); // adjust path if needed

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// ── Tooth chart mapping ──────────────────────────────────────────────────────
const TOOTH_ROW_LABELS = [
  "WithCaries","Amalgam","LC","OtherRestoMat","PLJC","PoJC",
  "Pontic","Missing","RF","Unerupted","ForExo","TF","Abutment","RCT","Impacted"
];
const TOOTH_QUADRANTS = ["upperRight","upperLeft","lowerRight","lowerLeft"];

function getCheckboxInfo(n) {
  if (n < 1 || n > 480) return null;
  const idx = n - 1;
  const isUpper = idx < 240;
  const sectionIdx = isUpper ? idx : idx - 240;
  const rowIdx = Math.floor(sectionIdx / 16);
  const posInRow = sectionIdx % 16;
  const quadrant = (isUpper ? "upper" : "lower") + (posInRow < 8 ? "Right" : "Left");
  const tooth = posInRow < 8 ? 8 - posInRow : posInRow - 8 + 1;
  return { quadrant, row: TOOTH_ROW_LABELS[rowIdx], tooth };
}

function emptyToothChart() {
  const result = {};
  for (const q of TOOTH_QUADRANTS) {
    result[q] = {};
    for (const r of TOOTH_ROW_LABELS) result[q][r] = Array(8).fill(false);
  }
  return result;
}

function flatToStructured(formData) {
  const tc = emptyToothChart();
  for (let n = 1; n <= 480; n++) {
    if (!formData[`Checkbox_${n}`]) continue;
    const info = getCheckboxInfo(n);
    if (info) tc[info.quadrant][info.row][info.tooth - 1] = true;
  }
  return tc;
}

function hasAnyChecked(toothChart) {
  for (const q of TOOTH_QUADRANTS) {
    for (const r of TOOTH_ROW_LABELS) {
      if (toothChart[q][r].some(Boolean)) return true;
    }
  }
  return false;
}

// ── Migration ────────────────────────────────────────────────────────────────
async function migrate() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const defForms = await Form.find({ formType: "def" });
  console.log(`Found ${defForms.length} DEF form(s) to check.`);

  let migrated = 0;
  let skipped = 0;
  let alreadyStructured = 0;

  for (const form of defForms) {
    const fd = form.formData || {};

    // Already migrated if toothChart exists and no Checkbox_N keys remain
    if (fd.toothChart && !Object.keys(fd).some(k => k.startsWith("Checkbox_"))) {
      alreadyStructured++;
      continue;
    }

    // Check if there are any flat Checkbox_N fields
    const hasFlat = Object.keys(fd).some(k => k.startsWith("Checkbox_"));
    if (!hasFlat) {
      skipped++;
      continue;
    }

    // Convert flat to structured
    const toothChart = flatToStructured(fd);
    const checkedCount = Object.values(toothChart)
      .flatMap(q => Object.values(q))
      .flat()
      .filter(Boolean).length;

    // Build clean formData without Checkbox_N keys
    const cleanFormData = {};
    for (const [k, v] of Object.entries(fd)) {
      if (!k.startsWith("Checkbox_")) {
        cleanFormData[k] = v;
      }
    }
    cleanFormData.toothChart = toothChart;

    // Use replaceOne to completely replace formData, removing old Checkbox_N keys
    await Form.replaceOne(
      { _id: form._id },
      {
        _id: form._id,
        userId: form.userId,
        formType: form.formType,
        formData: cleanFormData,
        createdAt: form.createdAt,
        updatedAt: new Date(),
        __v: form.__v,
      }
    );

    console.log(`  ✓ Migrated form ${form._id} (userId: ${form.userId}) — ${checkedCount} tooth checkmarks preserved`);
    migrated++;
  }

  console.log(`\nDone.`);
  console.log(`  Migrated:          ${migrated}`);
  console.log(`  Already structured: ${alreadyStructured}`);
  console.log(`  Skipped (no data):  ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});