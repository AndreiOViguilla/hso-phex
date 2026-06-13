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

// POST /api/forms/def
router.post("/def", authMiddleware, async (req, res) => {
  const { name, idNo } = req.body;
  try {
    await Form.findOneAndUpdate(
      { userId: req.user.id, formType: "def" },
      { userId: req.user.id, formType: "def", formData: req.body },
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