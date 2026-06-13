const express    = require("express");
const router     = express.Router();
const User       = require("../models/User");
const Form       = require("../models/Form");
const { PDFDocument } = require("pdf-lib");
const fs   = require("fs");
const path = require("path");
const Appointment = require("../models/Appointment");
const Settings   = require("../models/Settings");
const { authMiddleware } = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const Slot = require("../models/Slot");

// ── ADMIN + MASTER: Slot management ─────────────────────────────────────────

// GET /api/hso/slots?type=phex&date=2026-06-10
router.get("/slots", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const { type, date } = req.query;
    const query = {};
    if (type) query.appointmentType = type;
    if (date) query.date = date;
    const SlotModel = Slot.getModel(type || "phex");
    const slots = await SlotModel.find(date ? { date } : {}).sort({ date: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hso/slots — add a new slot day
router.post("/slots", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const { appointmentType, date, slots } = req.body;
    if (!appointmentType || !date || !slots) return res.status(400).json({ error: "appointmentType, date, and slots are required." });
    const SlotModel = Slot.getModel(appointmentType);
    const existing = await SlotModel.findOne({ date });
    if (existing) {
      existing.slots = slots;
      existing.type = appointmentType;
      await existing.save();
      return res.json(existing);
    }
    const newSlot = await SlotModel.create({ date, type: appointmentType, slots });
    res.json(newSlot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hso/slots/:type/:date — remove all slots for a date
router.delete("/slots/:type/:date", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const { type, date } = req.params;
    const SlotModel = Slot.getModel(type);
    await SlotModel.deleteOne({ date });
    res.json({ message: "Slots deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN + MASTER: Venue/location settings ──────────────────────────────────

// GET /api/hso/settings
router.get("/settings", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const settings = await Settings.find({});
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hso/settings — upsert a setting key
router.put("/settings", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: "key and value required." });
    const setting = await Settings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN + MASTER: View all students ────────────────────────────────────────

// GET /api/hso/students
router.get("/students", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const students = await User.find({ role: "student" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(students.map(u => u.toSafeObject ? u.toSafeObject() : u));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hso/students/:id/appointments
router.get("/students/:id/appointments", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const appts = await Appointment.find({ userId: req.params.id }).sort({ appointmentDate: 1 });
    res.json(appts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NURSE + ADMIN + MASTER: Today's appointments ─────────────────────────────

// GET /api/hso/appointments/today?type=phex
router.get("/appointments/today", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.appointmentType = type;
    const appts = await Appointment.find(filter).sort({ appointmentDate: 1, timeSlot: 1 });

    // Attach student info
    const studentIds = appts.map(a => a.studentId);
    const students = await User.find({ studentId: { $in: studentIds } }).select("-passwordHash");
    const studentMap = {};
    students.forEach(s => { studentMap[s.studentId] = s.toSafeObject ? s.toSafeObject() : s; });

    const result = appts.map(a => ({
      ...a.toObject(),
      student: studentMap[a.studentId] || null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NURSE + ADMIN + MASTER: Mark MEF/DEF as filled for a student ─────────────

// PUT /api/hso/students/:id/forms
router.put("/students/:id/forms", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const { filledMEF, filledDEF } = req.body;
    const update = {};
    if (typeof filledMEF === "boolean") update.filledMEF = filledMEF;
    if (typeof filledDEF === "boolean") update.filledDEF = filledDEF;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields to update." });

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Student not found." });
    res.json(user.toSafeObject ? user.toSafeObject() : user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hso/students/:id/mef — get student's MEF form data (for nurse to view)
router.get("/students/:id/mef", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Student not found." });

    const form = await Form.findOne({ userId: req.params.id, formType: "mef" });
    res.json({
      student: user.toSafeObject ? user.toSafeObject() : user,
      formData: form?.formData || {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hso/students/:id/mef — save nurse's MEF form data
router.put("/students/:id/mef", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Student not found." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "mef" });
    const mergedData = { ...(existing?.formData || {}), ...req.body };

    await Form.findOneAndUpdate(
      { userId: req.params.id, formType: "mef" },
      { userId: req.params.id, formType: "mef", formData: mergedData },
      { upsert: true, new: true }
    );

    // Mark as filled
    user.filledMEF = true;
    await user.save();

    res.json({ message: "MEF saved.", formData: mergedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hso/students/:id/mef/pdf — generate full MEF PDF (student + nurse fields)
router.post("/students/:id/mef/pdf", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/medical-examination-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "MEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "mef" });
    const data = { ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    // All text fields
    const TEXT_FIELD_NAMES = [
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
    TEXT_FIELD_NAMES.forEach(name => {
      try { form.getTextField(name).setText(data[name] || ""); } catch (_) {}
    });

    // All checkbox fields
    const CHECKBOX_FIELD_NAMES = [
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
    CHECKBOX_FIELD_NAMES.forEach(name => {
      try {
        const cb = form.getCheckBox(name);
        data[name] ? cb.check() : cb.uncheck();
      } catch (_) {}
    });

    try { form.flatten(); } catch (_) {}
    const bytes = await pdfDoc.save({ updateFieldAppearances: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="MEF_Full_${data["ID Number"] || "student"}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── DEF (Dental Examination Form) routes ─────────────────────────────────────

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

// Auto-fills "Assigned Dentist" (logged-in nurse's name), "Date" (today),
// and "Academic Year" (from Settings, falling back to a sensible default).
async function autofillDefMeta(req) {
  const meta = {};

  try {
    const nurse = await User.findById(req.user.id).select("firstName lastName");
    if (nurse) {
      meta["Assigned Dentist"] = `${nurse.firstName || ""} ${nurse.lastName || ""}`.trim();
    }
  } catch (_) {}

  meta["Date"] = new Date().toISOString().split("T")[0];

  try {
    const setting = await Settings.findOne({ key: "academic_year" });
    meta["Academic Year"] = setting?.value || "2025-2026";
  } catch (_) {
    meta["Academic Year"] = "2025-2026";
  }

  return meta;
}

// GET /api/hso/students/:id/def — get student's DEF form data (for nurse to view)
router.get("/students/:id/def", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Student not found." });

    const form = await Form.findOne({ userId: req.params.id, formType: "def" });
    const autofill = await autofillDefMeta(req);
    const formData = { ...autofill, ...(form?.formData || {}) };

    res.json({
      student: user.toSafeObject ? user.toSafeObject() : user,
      formData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hso/students/:id/def — save nurse's DEF form data
router.put("/students/:id/def", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Student not found." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "def" });
    const mergedData = { ...(existing?.formData || {}), ...req.body };

    await Form.findOneAndUpdate(
      { userId: req.params.id, formType: "def" },
      { userId: req.params.id, formType: "def", formData: mergedData },
      { upsert: true, new: true }
    );

    user.filledDEF = true;
    await user.save();

    res.json({ message: "DEF saved.", formData: mergedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AcroForm-preserving PREVIEW route (used by the nurse DEF preview) ───────
// POST /api/hso/students/:id/def/pdf
router.post("/students/:id/def/pdf", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/dental-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "DEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "def" });
    const autofill = await autofillDefMeta(req);
    const data = { ...autofill, ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillDefForm(form, data);

    const bytes = await pdfDoc.save({ updateFieldAppearances: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="DEF_${data["ID No"] || "student"}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── FLATTENED DOWNLOAD route (used by the "Download filled DEF PDF" button) ─
// POST /api/hso/students/:id/def/pdf/download
router.post("/students/:id/def/pdf/download", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/dental-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "DEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "def" });
    const autofill = await autofillDefMeta(req);
    const data = { ...autofill, ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillDefForm(form, data);

    try { form.flatten(); } catch (_) {}
    const bytes = await pdfDoc.save({ updateFieldAppearances: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="DEF_${data["ID No"] || "student"}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── MASTER ONLY: Delete student account ─────────────────────────────────────
router.delete("/students/:id", authMiddleware, requireRole("master"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.role !== "student") return res.status(400).json({ error: "This route is for student accounts only." });
    // Also delete their appointments
    await Appointment.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Student account and appointments deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MASTER ONLY: User management ─────────────────────────────────────────────

// GET /api/hso/users — all non-student accounts
router.get("/users", authMiddleware, requireRole("master"), async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["admin", "master", "nurse"] } })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(users.map(u => u.toSafeObject ? u.toSafeObject() : u));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hso/users — create admin/nurse/master account
router.post("/users", authMiddleware, requireRole("master"), async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");
    const { studentId, email, firstName, lastName, role, password } = req.body;
    if (!email || !firstName || !lastName || !role || !password)
      return res.status(400).json({ error: "All fields required." });
    if (!["admin", "nurse", "master"].includes(role))
      return res.status(400).json({ error: "Invalid role." });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ studentId: studentId || email, email, firstName, lastName, role, passwordHash });
    res.json({ message: "Account created.", user: { id: user._id, email, firstName, lastName, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hso/users/:id/role — change role
router.put("/users/:id/role", authMiddleware, requireRole("master"), async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "nurse", "master", "student"].includes(role))
      return res.status(400).json({ error: "Invalid role." });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hso/users/:id — remove account
router.delete("/users/:id", authMiddleware, requireRole("master"), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete your own account." });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Account deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;