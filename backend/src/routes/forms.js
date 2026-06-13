const express = require("express");
const { PDFDocument } = require("pdf-lib");
const fs   = require("fs");
const path = require("path");
const Form = require("../models/Form");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

async function fillAndSendPDF(res, pdfPath, fieldMap, checkboxMap, filename) {
  if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF template not found" });

  const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
  const form   = pdfDoc.getForm();

  for (const [name, value] of Object.entries(fieldMap)) {
    try { form.getTextField(name).setText(value || ""); } catch (_) {}
  }
  for (const [name, checked] of Object.entries(checkboxMap || {})) {
    try { checked ? form.getCheckBox(name).check() : form.getCheckBox(name).uncheck(); } catch (_) {}
  }

  try { form.flatten(); } catch (_) {}
  const bytes = await pdfDoc.save({ updateFieldAppearances: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

// Maps the student MEF form's camelCase keys -> PDF AcroForm field names,
// so the saved Form.formData uses the same key names the nurse's PDF
// generation routes (in hso.js) expect.
function buildMefPdfFieldMap(body) {
  const {
    idNumber, date, lastName, firstName, mi, gender, birthday, contact,
    college, academicYear, emergencyName, emergencyRel, emergencyContact,
    studentNameAuth, studentAge,
  } = body;

  return {
    "ID Number":          idNumber,
    "Date":               date,
    "Last Name":          lastName,
    "First Name":         firstName,
    "MI":                 mi,
    "Birthday":           birthday,
    "Contact Number":     contact,
    "College Section":    college,
    "Academic Year":      academicYear,
    "Emergency Name":     emergencyName,
    "Relationship":       emergencyRel,
    "Emergency Contact":  emergencyContact,
    "Student Name Auth":  studentNameAuth,
    "Student Age":        studentAge,
    "Gender Female":      gender === "Female",
    "Gender Male":        gender === "Male",
  };
}

// ── Shared field lists for the full MEF PDF (student + nurse fields) ───────
const MEF_TEXT_FIELD_NAMES = [
  "ID Number", "Date", "Last Name", "First Name", "MI", "Birthday",
  "Contact Number", "College Section", "Academic Year", "Emergency Name",
  "Relationship", "Emergency Contact", "Student Name Auth", "Student Age",
  "Blood Type", "Blood Pressure", "Resp Rate", "Pulse Rate", "Temperature",
  "Height Inches", "Weight Pounds", "BMI", "BMI Category", "LMP Female",
  "Medical History 1", "Medical History 2", "Medical History 3", "Medical History 4",
  "Present Medication 1", "Present Medication 2",
  "Left Vision", "Right Vision", "Smoking Details", "Drinking Details",
  "Exercising Details", "Type Of Disability", "Diagnosis Impression",
  "EENT Findings", "Head Neck Findings", "Breast Findings", "Lungs Findings",
  "Heart Findings", "Skin Findings", "Abdomen Findings", "Neurologic Findings",
  "Chest Xray Findings", "Drug Test Findings",
  "Restrictions Details", "Clearance Specialty Reason", "Examining Physician",
  "Assigned Nurse", "License Number", "Encoded By",
];

const MEF_CHECKBOX_FIELD_NAMES = [
  "Gender Female", "Gender Male", "With Corrective Lens",
  "Disability No", "Disability Yes", "PWD Card No", "PWD Card Yes",
  "Right Handed", "Left Handed", "Ambidextrous",
  "Smoking No", "Smoking Yes", "Drinking No", "Drinking Yes",
  "Exercising No", "Exercising Yes",
  "EENT Normal", "Head Neck Normal", "Breast Normal", "Lungs Normal",
  "Heart Normal", "Skin Normal", "Abdomen Normal", "Neurologic Normal",
  "Chest Xray Normal", "Drug Test Normal",
  "Fit For Academic Activities", "Fit With Restrictions", "Pending Classification",
  "For Additional Xray", "For Clearance",
];

function fillMefForm(form, data) {
  MEF_TEXT_FIELD_NAMES.forEach(name => {
    try { form.getTextField(name).setText(data[name] || ""); } catch (_) {}
  });
  MEF_CHECKBOX_FIELD_NAMES.forEach(name => {
    try {
      const cb = form.getCheckBox(name);
      data[name] ? cb.check() : cb.uncheck();
    } catch (_) {}
  });
}

// POST /api/forms/mef/preview — AcroForm-preserving preview for the STUDENT.
// Merges saved Form.formData (includes nurse-filled fields, if any) with the
// student's live in-progress edits (req.body, PDF-field-name keyed), and
// returns a non-flattened PDF so pdf.js can render the annotation layer.
router.post("/mef/preview", authMiddleware, async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/medical-examination-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "MEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.user.id, formType: "mef" });
    const liveStudentFields = buildMefPdfFieldMap(req.body);
    const data = { ...(existing?.formData || {}), ...liveStudentFields };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillMefForm(form, data);

    // Not flattened — keeps AcroForm alive for annotation layer rendering.
    const bytes = await pdfDoc.save({ updateFieldAppearances: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="MEF_preview.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/forms/mef
router.post("/mef", authMiddleware, async (req, res) => {
  try {
    const pdfFieldData = buildMefPdfFieldMap(req.body);

    // Save using PDF field names so nurse-side routes can read them directly
    const existing = await Form.findOne({ userId: req.user.id, formType: "mef" });
    const mergedData = { ...(existing?.formData || {}), ...pdfFieldData };

    await Form.findOneAndUpdate(
      { userId: req.user.id, formType: "mef" },
      { userId: req.user.id, formType: "mef", formData: mergedData },
      { upsert: true, new: true }
    );

    const { idNumber, date, lastName, firstName, mi, gender, birthday, contact, college, academicYear, emergencyName, emergencyRel, emergencyContact, studentNameAuth, studentAge } = req.body;

    await fillAndSendPDF(
      res,
      path.join(__dirname, "../../public/medical-examination-form.pdf"),
      { "ID Number": idNumber, "Date": date, "Last Name": lastName, "First Name": firstName, "MI": mi, "Birthday": birthday, "Contact Number": contact, "College Section": college, "Academic Year": academicYear, "Emergency Name": emergencyName, "Relationship": emergencyRel, "Emergency Contact": emergencyContact, "Student Name Auth": studentNameAuth, "Student Age": studentAge },
      { "Gender Female": gender === "Female", "Gender Male": gender === "Male" },
      `MEF_${idNumber || "student"}.pdf`
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate MEF" });
  }
});

// ── Shared field lists for the full DEF PDF (student + nurse/dentist fields) ──
const DEF_TEXT_FIELD_NAMES = [
  "Name", "ID No", "Assigned Dentist", "Date", "Academic Year",
  "Others Text", "Other Remarks 1", "Other Remarks 2", "Other Remarks 3", "Other Remarks 4",
];

const DEF_CHECKBOX_FIELD_NAMES = [
  "Good oral hygiene", "Calcular deposits", "Gingivitis", "Pyorrheatic",
  "Denture wearer up", "Denture wearer down",
  "Ortho braces up", "Ortho braces down", "Hawleys retainers",
];

function fillDefForm(form, data) {
  DEF_TEXT_FIELD_NAMES.forEach(name => {
    try { form.getTextField(name).setText(data[name] || ""); } catch (_) {}
  });
  DEF_CHECKBOX_FIELD_NAMES.forEach(name => {
    try {
      const cb = form.getCheckBox(name);
      data[name] ? cb.check() : cb.uncheck();
    } catch (_) {}
  });
}

// POST /api/forms/def/preview — AcroForm-preserving preview for the STUDENT.
// Merges saved Form.formData (includes nurse/dentist-filled fields, if any)
// with the student's live Name/ID No, and returns a non-flattened PDF so
// pdf.js can render the annotation layer.
router.post("/def/preview", authMiddleware, async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/dental-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "DEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.user.id, formType: "def" });
    const { name, idNo } = req.body;
    const data = { ...(existing?.formData || {}) };
    if (name !== undefined)  data["Name"]  = name;
    if (idNo !== undefined)  data["ID No"] = idNo;

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillDefForm(form, data);

    // Not flattened — keeps AcroForm alive for annotation layer rendering.
    const bytes = await pdfDoc.save({ updateFieldAppearances: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="DEF_preview.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/forms/def — student saves Name/ID No (auto-filled from profile)
router.post("/def", authMiddleware, async (req, res) => {
  const { name, idNo } = req.body;
  try {
    const existing = await Form.findOne({ userId: req.user.id, formType: "def" });
    const mergedData = { ...(existing?.formData || {}), "Name": name, "ID No": idNo };

    await Form.findOneAndUpdate(
      { userId: req.user.id, formType: "def" },
      { userId: req.user.id, formType: "def", formData: mergedData },
      { upsert: true, new: true }
    );

    await fillAndSendPDF(
      res,
      path.join(__dirname, "../../public/dental-form.pdf"),
      { "Name": name, "ID No": idNo },
      {},
      `DEF_${idNo || "student"}.pdf`
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate DEF" });
  }
});

// GET /api/forms/mine
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const forms = await Form.find({ userId: req.user.id });
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch forms" });
  }
});

module.exports = router;