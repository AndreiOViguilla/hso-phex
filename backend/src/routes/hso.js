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
const { sendMEFFilledEmail, sendDEFFilledEmail } = require("../services/email");
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

    // Always populate student identity fields from the user record so the
    // nurse preview is correct even if the student hasn't submitted their
    // own MEF form yet.
    const existing = form?.formData || {};
    const formData = {
      ...existing,
      "ID Number":      user.studentId      || existing["ID Number"]      || "",
      "First Name":     user.firstName      || existing["First Name"]      || "",
      "Last Name":      user.lastName       || existing["Last Name"]       || "",
      "MI":             user.middleInitial  || existing["MI"]              || "",
      "Birthday":       user.birthday       || existing["Birthday"]        || "",
      "Contact Number": user.contact        || existing["Contact Number"]  || "",
      "College Section":user.college        || existing["College Section"] || "",
      "Gender Female":  (user.gender === "Female") || !!existing["Gender Female"],
      "Gender Male":    (user.gender === "Male")   || !!existing["Gender Male"],
    };

    res.json({
      student: user.toSafeObject ? user.toSafeObject() : user,
      formData,
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

    // Send email notification (non-blocking — never crashes the request)
    const nurse = await User.findById(req.user.id).select("firstName lastName");
    const academicYear = mergedData["Academic Year"] || "";
    sendMEFFilledEmail(user, nurse, { academicYear }).catch(() => {});

    res.json({ message: "MEF saved.", formData: mergedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  "Disability No", "Disability Yes", "With PWD card No", "With PWD card Yes",
  "Right Handed", "Left handed", "Ambidextrous",
  "Smoking No", "Smoking Yes", "Drinking No", "Drinking Yes",
  "Exercising No", "Exercising Yes",
  "EENT Normal", "Head Neck Normal", "Breast Normal", "Lungs Normal",
  "Heart Normal", "Skin Normal", "Abdomen", "Neurologic Normal",
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

// POST /api/hso/students/:id/mef/pdf — AcroForm-PRESERVING PREVIEW (non-flattened)
router.post("/students/:id/mef/pdf", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/medical-examination-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "MEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "mef" });
    const data = { ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillMefForm(form, data);

    // NOT flattened — keeps AcroForm alive so the annotation layer can render.
    // updateFieldAppearances: false — the canvas won't bake in field text,
    // so it won't double up with the frontend's LiveFieldOverlay, which now
    // shows live values instantly on top of the canvas.
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="MEF_preview.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Hardcoded MEF checkbox positions (PDF user space, origin bottom-left)
const MEF_CHECKBOX_POSITIONS = {
  "Gender Female": { x: 88.7, y: 650.5, w: 8.3, h: 7.7 },
  "Gender Male": { x: 141.3, y: 650.9, w: 8.5, h: 7.4 },
  "EENT Normal": { x: 345.0, y: 407.0, w: 9.0, h: 9.0 },
  "Head Neck Normal": { x: 345.0, y: 376.0, w: 9.0, h: 9.0 },
  "Breast Normal": { x: 345.0, y: 347.0, w: 9.0, h: 9.0 },
  "Lungs Normal": { x: 345.0, y: 318.0, w: 9.0, h: 9.0 },
  "Heart Normal": { x: 345.0, y: 291.0, w: 9.0, h: 9.0 },
  "Smoking No": { x: 226.0, y: 264.0, w: 9.0, h: 9.0 },
  "Smoking Yes": { x: 255.0, y: 263.0, w: 9.0, h: 9.0 },
  "Skin Normal": { x: 345.0, y: 263.0, w: 9.0, h: 9.0 },
  "Drinking No": { x: 226.0, y: 250.0, w: 9.0, h: 9.0 },
  "Drinking Yes": { x: 256.0, y: 250.0, w: 9.0, h: 9.0 },
  "With Corrective Lens": { x: 37.0, y: 238.0, w: 9.0, h: 9.0 },
  "Exercising No": { x: 226.0, y: 236.0, w: 9.0, h: 9.0 },
  "Exercising Yes": { x: 257.0, y: 238.0, w: 9.0, h: 9.0 },
  "Abdomen": { x: 345.0, y: 237.0, w: 9.0, h: 9.0 },
  "Disability No": { x: 78.0, y: 212.0, w: 9.0, h: 9.0 },
  "Disability Yes": { x: 107.0, y: 212.0, w: 9.0, h: 9.0 },
  "Right Handed": { x: 182.0, y: 212.0, w: 9.0, h: 9.0 },
  "Neurologic Normal": { x: 345.0, y: 210.0, w: 9.0, h: 9.0 },
  "With PWD card No": { x: 103.0, y: 198.0, w: 9.0, h: 9.0 },
  "With PWD card Yes": { x: 132.0, y: 198.0, w: 9.0, h: 9.0 },
  "Left handed": { x: 182.0, y: 197.0, w: 9.0, h: 9.0 },
  "Ambidextrous": { x: 182.0, y: 185.0, w: 9.0, h: 9.0 },
  "Chest Xray Normal": { x: 345.0, y: 183.0, w: 9.0, h: 9.0 },
  "Drug Test Normal": { x: 345.0, y: 156.0, w: 9.0, h: 9.0 },
  "Fit For Academic Activities": { x: 47.0, y: 105.0, w: 9.0, h: 9.0 },
  "Fit With Restrictions": { x: 47.0, y: 94.0, w: 9.0, h: 9.0 },
  "Pending Classification": { x: 47.0, y: 82.0, w: 9.0, h: 9.0 },
  "For Additional Xray": { x: 158.0, y: 81.0, w: 9.0, h: 9.0 },
  "For Clearance": { x: 257.0, y: 82.0, w: 9.0, h: 9.0 },
};

function drawMefCheckmarks(page, data) {
  for (const [name, pos] of Object.entries(MEF_CHECKBOX_POSITIONS)) {
    if (!data[name]) continue;
    const { x, y, w, h } = pos;
    const thickness = Math.max(0.8, Math.min(w, h) * 0.18);
    page.drawLine({
      start: { x: x + w * 0.1, y: y + h * 0.45 },
      end:   { x: x + w * 0.4, y: y + h * 0.15 },
      thickness, color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: x + w * 0.4, y: y + h * 0.15 },
      end:   { x: x + w * 0.9, y: y + h * 0.82 },
      thickness, color: rgb(0, 0, 0),
    });
  }
}

// POST /api/hso/students/:id/mef/pdf/download — FLATTENED final PDF for download
router.post("/students/:id/mef/pdf/download", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/medical-examination-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "MEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "mef" });
    const data = { ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    // Fill text fields only
    MEF_TEXT_FIELD_NAMES.forEach(name => {
      try { form.getTextField(name).setText(data[name] || ""); } catch (_) {}
    });

    // Draw checkmarks manually — avoids ZapfDingbats font dependency
    const page = pdfDoc.getPages()[0];
    drawMefCheckmarks(page, data);

    try { form.flatten(); } catch (_) {}
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

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
  "Good oral hygiene",
  "Calcular deposits",
  "Gingivitis",
  "Pyorrheatic",
  "Denture wearer up",
  "Denture wearer down",
  "Ortho braces up",
  "Ortho braces down",
  "Hawleys retainers",
  "Others",
  "Checkbox_1",
  "Checkbox_2",
  "Checkbox_3",
  "Checkbox_4",
  "Checkbox_5",
  "Checkbox_6",
  "Checkbox_7",
  "Checkbox_8",
  "Checkbox_9",
  "Checkbox_10",
  "Checkbox_11",
  "Checkbox_12",
  "Checkbox_13",
  "Checkbox_14",
  "Checkbox_15",
  "Checkbox_16",
  "Checkbox_17",
  "Checkbox_18",
  "Checkbox_19",
  "Checkbox_20",
  "Checkbox_21",
  "Checkbox_22",
  "Checkbox_23",
  "Checkbox_24",
  "Checkbox_25",
  "Checkbox_26",
  "Checkbox_27",
  "Checkbox_28",
  "Checkbox_29",
  "Checkbox_30",
  "Checkbox_31",
  "Checkbox_32",
  "Checkbox_33",
  "Checkbox_34",
  "Checkbox_35",
  "Checkbox_36",
  "Checkbox_37",
  "Checkbox_38",
  "Checkbox_39",
  "Checkbox_40",
  "Checkbox_41",
  "Checkbox_42",
  "Checkbox_43",
  "Checkbox_44",
  "Checkbox_45",
  "Checkbox_46",
  "Checkbox_47",
  "Checkbox_48",
  "Checkbox_49",
  "Checkbox_50",
  "Checkbox_51",
  "Checkbox_52",
  "Checkbox_53",
  "Checkbox_54",
  "Checkbox_55",
  "Checkbox_56",
  "Checkbox_57",
  "Checkbox_58",
  "Checkbox_59",
  "Checkbox_60",
  "Checkbox_61",
  "Checkbox_62",
  "Checkbox_63",
  "Checkbox_64",
  "Checkbox_65",
  "Checkbox_66",
  "Checkbox_67",
  "Checkbox_68",
  "Checkbox_69",
  "Checkbox_70",
  "Checkbox_71",
  "Checkbox_72",
  "Checkbox_73",
  "Checkbox_74",
  "Checkbox_75",
  "Checkbox_76",
  "Checkbox_77",
  "Checkbox_78",
  "Checkbox_79",
  "Checkbox_80",
  "Checkbox_81",
  "Checkbox_82",
  "Checkbox_83",
  "Checkbox_84",
  "Checkbox_85",
  "Checkbox_86",
  "Checkbox_87",
  "Checkbox_88",
  "Checkbox_89",
  "Checkbox_90",
  "Checkbox_91",
  "Checkbox_92",
  "Checkbox_93",
  "Checkbox_94",
  "Checkbox_95",
  "Checkbox_96",
  "Checkbox_97",
  "Checkbox_98",
  "Checkbox_99",
  "Checkbox_100",
  "Checkbox_101",
  "Checkbox_102",
  "Checkbox_103",
  "Checkbox_104",
  "Checkbox_105",
  "Checkbox_106",
  "Checkbox_107",
  "Checkbox_108",
  "Checkbox_109",
  "Checkbox_110",
  "Checkbox_111",
  "Checkbox_112",
  "Checkbox_113",
  "Checkbox_114",
  "Checkbox_115",
  "Checkbox_116",
  "Checkbox_117",
  "Checkbox_118",
  "Checkbox_119",
  "Checkbox_120",
  "Checkbox_121",
  "Checkbox_122",
  "Checkbox_123",
  "Checkbox_124",
  "Checkbox_125",
  "Checkbox_126",
  "Checkbox_127",
  "Checkbox_128",
  "Checkbox_129",
  "Checkbox_130",
  "Checkbox_131",
  "Checkbox_132",
  "Checkbox_133",
  "Checkbox_134",
  "Checkbox_135",
  "Checkbox_136",
  "Checkbox_137",
  "Checkbox_138",
  "Checkbox_139",
  "Checkbox_140",
  "Checkbox_141",
  "Checkbox_142",
  "Checkbox_143",
  "Checkbox_144",
  "Checkbox_145",
  "Checkbox_146",
  "Checkbox_147",
  "Checkbox_148",
  "Checkbox_149",
  "Checkbox_150",
  "Checkbox_151",
  "Checkbox_152",
  "Checkbox_153",
  "Checkbox_154",
  "Checkbox_155",
  "Checkbox_156",
  "Checkbox_157",
  "Checkbox_158",
  "Checkbox_159",
  "Checkbox_160",
  "Checkbox_161",
  "Checkbox_162",
  "Checkbox_163",
  "Checkbox_164",
  "Checkbox_165",
  "Checkbox_166",
  "Checkbox_167",
  "Checkbox_168",
  "Checkbox_169",
  "Checkbox_170",
  "Checkbox_171",
  "Checkbox_172",
  "Checkbox_173",
  "Checkbox_174",
  "Checkbox_175",
  "Checkbox_176",
  "Checkbox_177",
  "Checkbox_178",
  "Checkbox_179",
  "Checkbox_180",
  "Checkbox_181",
  "Checkbox_182",
  "Checkbox_183",
  "Checkbox_184",
  "Checkbox_185",
  "Checkbox_186",
  "Checkbox_187",
  "Checkbox_188",
  "Checkbox_189",
  "Checkbox_190",
  "Checkbox_191",
  "Checkbox_192",
  "Checkbox_193",
  "Checkbox_194",
  "Checkbox_195",
  "Checkbox_196",
  "Checkbox_197",
  "Checkbox_198",
  "Checkbox_199",
  "Checkbox_200",
  "Checkbox_201",
  "Checkbox_202",
  "Checkbox_203",
  "Checkbox_204",
  "Checkbox_205",
  "Checkbox_206",
  "Checkbox_207",
  "Checkbox_208",
  "Checkbox_209",
  "Checkbox_210",
  "Checkbox_211",
  "Checkbox_212",
  "Checkbox_213",
  "Checkbox_214",
  "Checkbox_215",
  "Checkbox_216",
  "Checkbox_217",
  "Checkbox_218",
  "Checkbox_219",
  "Checkbox_220",
  "Checkbox_221",
  "Checkbox_222",
  "Checkbox_223",
  "Checkbox_224",
  "Checkbox_225",
  "Checkbox_226",
  "Checkbox_227",
  "Checkbox_228",
  "Checkbox_229",
  "Checkbox_230",
  "Checkbox_231",
  "Checkbox_232",
  "Checkbox_233",
  "Checkbox_234",
  "Checkbox_235",
  "Checkbox_236",
  "Checkbox_237",
  "Checkbox_238",
  "Checkbox_239",
  "Checkbox_240",
  "Checkbox_241",
  "Checkbox_242",
  "Checkbox_243",
  "Checkbox_244",
  "Checkbox_245",
  "Checkbox_246",
  "Checkbox_247",
  "Checkbox_248",
  "Checkbox_249",
  "Checkbox_250",
  "Checkbox_251",
  "Checkbox_252",
  "Checkbox_253",
  "Checkbox_254",
  "Checkbox_255",
  "Checkbox_256",
  "Checkbox_257",
  "Checkbox_258",
  "Checkbox_259",
  "Checkbox_260",
  "Checkbox_261",
  "Checkbox_262",
  "Checkbox_263",
  "Checkbox_264",
  "Checkbox_265",
  "Checkbox_266",
  "Checkbox_267",
  "Checkbox_268",
  "Checkbox_269",
  "Checkbox_270",
  "Checkbox_271",
  "Checkbox_272",
  "Checkbox_273",
  "Checkbox_274",
  "Checkbox_275",
  "Checkbox_276",
  "Checkbox_277",
  "Checkbox_278",
  "Checkbox_279",
  "Checkbox_280",
  "Checkbox_281",
  "Checkbox_282",
  "Checkbox_283",
  "Checkbox_284",
  "Checkbox_285",
  "Checkbox_286",
  "Checkbox_287",
  "Checkbox_288",
  "Checkbox_289",
  "Checkbox_290",
  "Checkbox_291",
  "Checkbox_292",
  "Checkbox_293",
  "Checkbox_294",
  "Checkbox_295",
  "Checkbox_296",
  "Checkbox_297",
  "Checkbox_298",
  "Checkbox_299",
  "Checkbox_300",
  "Checkbox_301",
  "Checkbox_302",
  "Checkbox_303",
  "Checkbox_304",
  "Checkbox_305",
  "Checkbox_306",
  "Checkbox_307",
  "Checkbox_308",
  "Checkbox_309",
  "Checkbox_310",
  "Checkbox_311",
  "Checkbox_312",
  "Checkbox_313",
  "Checkbox_314",
  "Checkbox_315",
  "Checkbox_316",
  "Checkbox_317",
  "Checkbox_318",
  "Checkbox_319",
  "Checkbox_320",
  "Checkbox_321",
  "Checkbox_322",
  "Checkbox_323",
  "Checkbox_324",
  "Checkbox_325",
  "Checkbox_326",
  "Checkbox_327",
  "Checkbox_328",
  "Checkbox_329",
  "Checkbox_330",
  "Checkbox_331",
  "Checkbox_332",
  "Checkbox_333",
  "Checkbox_334",
  "Checkbox_335",
  "Checkbox_336",
  "Checkbox_337",
  "Checkbox_338",
  "Checkbox_339",
  "Checkbox_340",
  "Checkbox_341",
  "Checkbox_342",
  "Checkbox_343",
  "Checkbox_344",
  "Checkbox_345",
  "Checkbox_346",
  "Checkbox_347",
  "Checkbox_348",
  "Checkbox_349",
  "Checkbox_350",
  "Checkbox_351",
  "Checkbox_352",
  "Checkbox_353",
  "Checkbox_354",
  "Checkbox_355",
  "Checkbox_356",
  "Checkbox_357",
  "Checkbox_358",
  "Checkbox_359",
  "Checkbox_360",
  "Checkbox_361",
  "Checkbox_362",
  "Checkbox_363",
  "Checkbox_364",
  "Checkbox_365",
  "Checkbox_366",
  "Checkbox_367",
  "Checkbox_368",
  "Checkbox_369",
  "Checkbox_370",
  "Checkbox_371",
  "Checkbox_372",
  "Checkbox_373",
  "Checkbox_374",
  "Checkbox_375",
  "Checkbox_376",
  "Checkbox_377",
  "Checkbox_378",
  "Checkbox_379",
  "Checkbox_380",
  "Checkbox_381",
  "Checkbox_382",
  "Checkbox_383",
  "Checkbox_384",
  "Checkbox_385",
  "Checkbox_386",
  "Checkbox_387",
  "Checkbox_388",
  "Checkbox_389",
  "Checkbox_390",
  "Checkbox_391",
  "Checkbox_392",
  "Checkbox_393",
  "Checkbox_394",
  "Checkbox_395",
  "Checkbox_396",
  "Checkbox_397",
  "Checkbox_398",
  "Checkbox_399",
  "Checkbox_400",
  "Checkbox_401",
  "Checkbox_402",
  "Checkbox_403",
  "Checkbox_404",
  "Checkbox_405",
  "Checkbox_406",
  "Checkbox_407",
  "Checkbox_408",
  "Checkbox_409",
  "Checkbox_410",
  "Checkbox_411",
  "Checkbox_412",
  "Checkbox_413",
  "Checkbox_414",
  "Checkbox_415",
  "Checkbox_416",
  "Checkbox_417",
  "Checkbox_418",
  "Checkbox_419",
  "Checkbox_420",
  "Checkbox_421",
  "Checkbox_422",
  "Checkbox_423",
  "Checkbox_424",
  "Checkbox_425",
  "Checkbox_426",
  "Checkbox_427",
  "Checkbox_428",
  "Checkbox_429",
  "Checkbox_430",
  "Checkbox_431",
  "Checkbox_432",
  "Checkbox_433",
  "Checkbox_434",
  "Checkbox_435",
  "Checkbox_436",
  "Checkbox_437",
  "Checkbox_438",
  "Checkbox_439",
  "Checkbox_440",
  "Checkbox_441",
  "Checkbox_442",
  "Checkbox_443",
  "Checkbox_444",
  "Checkbox_445",
  "Checkbox_446",
  "Checkbox_447",
  "Checkbox_448",
  "Checkbox_449",
  "Checkbox_450",
  "Checkbox_451",
  "Checkbox_452",
  "Checkbox_453",
  "Checkbox_454",
  "Checkbox_455",
  "Checkbox_456",
  "Checkbox_457",
  "Checkbox_458",
  "Checkbox_459",
  "Checkbox_460",
  "Checkbox_461",
  "Checkbox_462",
  "Checkbox_463",
  "Checkbox_464",
  "Checkbox_465",
  "Checkbox_466",
  "Checkbox_467",
  "Checkbox_468",
  "Checkbox_469",
  "Checkbox_470",
  "Checkbox_471",
  "Checkbox_472",
  "Checkbox_473",
  "Checkbox_474",
  "Checkbox_475",
  "Checkbox_476",
  "Checkbox_477",
  "Checkbox_478",
  "Checkbox_479",
  "Checkbox_480",
  "Checkbox_481",
  "Checkbox_482",
  "Checkbox_483",
  "Checkbox_484",
  "Checkbox_485",
  "Checkbox_486",
  "Checkbox_487",
  "Checkbox_488",
  "Checkbox_489",
  "Checkbox_490",
  "Checkbox_491",
  "Checkbox_492",
  "Checkbox_493",
  "Checkbox_494",
  "Checkbox_495",
  "Checkbox_496",
  "Checkbox_497",
  "Checkbox_498",
  "Checkbox_499",
  "Checkbox_500",
  "Checkbox_501",
  "Checkbox_502",
  "Checkbox_503",
  "Checkbox_504",
  "Checkbox_505",
  "Checkbox_506",
  "Checkbox_507",
  "Checkbox_508",
  "Checkbox_509",
  "Checkbox_510",
  "Checkbox_511",
  "Checkbox_512"
];

const { rgb } = require("pdf-lib");

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

const DEF_CHECKBOX_POSITIONS = {
  "Good oral hygiene": { x: 32.1, y: 479.1, w: 18.0, h: 18.0 },
  "Calcular deposits": { x: 31.3, y: 445.2, w: 18.0, h: 18.0 },
  "Others": { x: 32.6, y: 198.2, w: 18.0, h: 18.0 },
  "Gingivitis": { x: 32.6, y: 407.9, w: 18.0, h: 18.0 },
  "Pyorrheatic": { x: 31.8, y: 374.7, w: 18.0, h: 18.0 },
  "Denture wearer up": { x: 32.9, y: 350.6, w: 18.0, h: 18.0 },
  "Denture wearer down": { x: 32.1, y: 321.8, w: 18.0, h: 18.0 },
  "Ortho braces up": { x: 31.6, y: 289.7, w: 18.0, h: 18.0 },
  "Ortho braces down": { x: 32.7, y: 258.7, w: 18.0, h: 18.0 },
  "Hawleys retainers": { x: 31.9, y: 227.8, w: 18.0, h: 18.0 },
  "Checkbox_1": { x: 185.3, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_2": { x: 204.7, y: 590.7, w: 14.7, h: 14.7 },
  "Checkbox_3": { x: 225.3, y: 590.7, w: 14.7, h: 14.7 },
  "Checkbox_4": { x: 243.3, y: 590.7, w: 14.7, h: 14.7 },
  "Checkbox_5": { x: 262.7, y: 590.0, w: 14.7, h: 14.7 },
  "Checkbox_6": { x: 283.3, y: 590.0, w: 14.7, h: 14.7 },
  "Checkbox_7": { x: 301.3, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_8": { x: 322.0, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_9": { x: 423.3, y: 592.0, w: 14.7, h: 14.7 },
  "Checkbox_10": { x: 442.7, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_11": { x: 463.3, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_12": { x: 481.3, y: 591.3, w: 14.7, h: 14.7 },
  "Checkbox_13": { x: 500.7, y: 590.7, w: 14.7, h: 14.7 },
  "Checkbox_14": { x: 521.3, y: 590.7, w: 14.7, h: 14.7 },
  "Checkbox_15": { x: 539.3, y: 592.0, w: 14.7, h: 14.7 },
  "Checkbox_16": { x: 560.0, y: 592.0, w: 14.7, h: 14.7 },
  "Checkbox_17": { x: 186.0, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_18": { x: 205.3, y: 572.7, w: 14.7, h: 14.7 },
  "Checkbox_19": { x: 226.0, y: 572.7, w: 14.7, h: 14.7 },
  "Checkbox_20": { x: 244.0, y: 572.7, w: 14.7, h: 14.7 },
  "Checkbox_21": { x: 263.3, y: 572.0, w: 14.7, h: 14.7 },
  "Checkbox_22": { x: 284.0, y: 572.0, w: 14.7, h: 14.7 },
  "Checkbox_23": { x: 302.0, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_24": { x: 322.7, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_25": { x: 424.0, y: 574.0, w: 14.7, h: 14.7 },
  "Checkbox_26": { x: 443.3, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_27": { x: 464.0, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_28": { x: 482.0, y: 573.3, w: 14.7, h: 14.7 },
  "Checkbox_29": { x: 501.3, y: 572.7, w: 14.7, h: 14.7 },
  "Checkbox_30": { x: 522.0, y: 572.7, w: 14.7, h: 14.7 },
  "Checkbox_31": { x: 540.0, y: 574.0, w: 14.7, h: 14.7 },
  "Checkbox_32": { x: 560.7, y: 574.0, w: 14.7, h: 14.7 },
  "Checkbox_33": { x: 185.3, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_34": { x: 204.7, y: 556.0, w: 14.7, h: 14.7 },
  "Checkbox_35": { x: 225.3, y: 556.0, w: 14.7, h: 14.7 },
  "Checkbox_36": { x: 243.3, y: 556.0, w: 14.7, h: 14.7 },
  "Checkbox_37": { x: 262.7, y: 555.3, w: 14.7, h: 14.7 },
  "Checkbox_38": { x: 283.3, y: 555.3, w: 14.7, h: 14.7 },
  "Checkbox_39": { x: 301.3, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_40": { x: 322.0, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_41": { x: 423.3, y: 557.3, w: 14.7, h: 14.7 },
  "Checkbox_42": { x: 442.7, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_43": { x: 463.3, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_44": { x: 481.3, y: 556.7, w: 14.7, h: 14.7 },
  "Checkbox_45": { x: 500.7, y: 556.0, w: 14.7, h: 14.7 },
  "Checkbox_46": { x: 521.3, y: 556.0, w: 14.7, h: 14.7 },
  "Checkbox_47": { x: 539.3, y: 557.3, w: 14.7, h: 14.7 },
  "Checkbox_48": { x: 560.0, y: 557.3, w: 14.7, h: 14.7 },
  "Checkbox_49": { x: 186.0, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_50": { x: 205.3, y: 538.0, w: 14.7, h: 14.7 },
  "Checkbox_51": { x: 226.0, y: 538.0, w: 14.7, h: 14.7 },
  "Checkbox_52": { x: 244.0, y: 538.0, w: 14.7, h: 14.7 },
  "Checkbox_53": { x: 263.3, y: 537.3, w: 14.7, h: 14.7 },
  "Checkbox_54": { x: 284.0, y: 537.3, w: 14.7, h: 14.7 },
  "Checkbox_55": { x: 302.0, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_56": { x: 322.7, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_57": { x: 424.0, y: 539.3, w: 14.7, h: 14.7 },
  "Checkbox_58": { x: 443.3, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_59": { x: 464.0, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_60": { x: 482.0, y: 538.7, w: 14.7, h: 14.7 },
  "Checkbox_61": { x: 501.3, y: 538.0, w: 14.7, h: 14.7 },
  "Checkbox_62": { x: 522.0, y: 538.0, w: 14.7, h: 14.7 },
  "Checkbox_63": { x: 540.0, y: 539.3, w: 14.7, h: 14.7 },
  "Checkbox_64": { x: 560.7, y: 539.3, w: 14.7, h: 14.7 },
  "Checkbox_65": { x: 184.7, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_66": { x: 204.0, y: 518.0, w: 14.7, h: 14.7 },
  "Checkbox_67": { x: 224.7, y: 518.0, w: 14.7, h: 14.7 },
  "Checkbox_68": { x: 242.7, y: 518.0, w: 14.7, h: 14.7 },
  "Checkbox_69": { x: 262.0, y: 517.3, w: 14.7, h: 14.7 },
  "Checkbox_70": { x: 282.7, y: 517.3, w: 14.7, h: 14.7 },
  "Checkbox_71": { x: 300.7, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_72": { x: 321.3, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_73": { x: 422.7, y: 519.3, w: 14.7, h: 14.7 },
  "Checkbox_74": { x: 442.0, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_75": { x: 462.7, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_76": { x: 480.7, y: 518.7, w: 14.7, h: 14.7 },
  "Checkbox_77": { x: 500.0, y: 518.0, w: 14.7, h: 14.7 },
  "Checkbox_78": { x: 520.7, y: 518.0, w: 14.7, h: 14.7 },
  "Checkbox_79": { x: 538.7, y: 519.3, w: 14.7, h: 14.7 },
  "Checkbox_80": { x: 559.3, y: 519.3, w: 14.7, h: 14.7 },
  "Checkbox_81": { x: 185.3, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_82": { x: 204.7, y: 500.0, w: 14.7, h: 14.7 },
  "Checkbox_83": { x: 225.3, y: 500.0, w: 14.7, h: 14.7 },
  "Checkbox_84": { x: 243.3, y: 500.0, w: 14.7, h: 14.7 },
  "Checkbox_85": { x: 262.7, y: 499.3, w: 14.7, h: 14.7 },
  "Checkbox_86": { x: 283.3, y: 499.3, w: 14.7, h: 14.7 },
  "Checkbox_87": { x: 301.3, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_88": { x: 322.0, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_89": { x: 423.3, y: 501.3, w: 14.7, h: 14.7 },
  "Checkbox_90": { x: 442.7, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_91": { x: 463.3, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_92": { x: 481.3, y: 500.7, w: 14.7, h: 14.7 },
  "Checkbox_93": { x: 500.7, y: 500.0, w: 14.7, h: 14.7 },
  "Checkbox_94": { x: 521.3, y: 500.0, w: 14.7, h: 14.7 },
  "Checkbox_95": { x: 539.3, y: 501.3, w: 14.7, h: 14.7 },
  "Checkbox_96": { x: 560.0, y: 501.3, w: 14.7, h: 14.7 },
  "Checkbox_97": { x: 184.7, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_98": { x: 204.0, y: 483.3, w: 14.7, h: 14.7 },
  "Checkbox_99": { x: 224.7, y: 483.3, w: 14.7, h: 14.7 },
  "Checkbox_100": { x: 242.7, y: 483.3, w: 14.7, h: 14.7 },
  "Checkbox_101": { x: 262.0, y: 482.7, w: 14.7, h: 14.7 },
  "Checkbox_102": { x: 282.7, y: 482.7, w: 14.7, h: 14.7 },
  "Checkbox_103": { x: 300.7, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_104": { x: 321.3, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_105": { x: 422.7, y: 484.7, w: 14.7, h: 14.7 },
  "Checkbox_106": { x: 442.0, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_107": { x: 462.7, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_108": { x: 480.7, y: 484.0, w: 14.7, h: 14.7 },
  "Checkbox_109": { x: 500.0, y: 483.3, w: 14.7, h: 14.7 },
  "Checkbox_110": { x: 520.7, y: 483.3, w: 14.7, h: 14.7 },
  "Checkbox_111": { x: 538.7, y: 484.7, w: 14.7, h: 14.7 },
  "Checkbox_112": { x: 559.3, y: 484.7, w: 14.7, h: 14.7 },
  "Checkbox_113": { x: 185.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_114": { x: 204.7, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_115": { x: 225.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_116": { x: 243.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_117": { x: 262.7, y: 464.7, w: 14.7, h: 14.7 },
  "Checkbox_118": { x: 283.3, y: 464.7, w: 14.7, h: 14.7 },
  "Checkbox_119": { x: 301.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_120": { x: 322.0, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_121": { x: 423.3, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_122": { x: 442.7, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_123": { x: 463.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_124": { x: 481.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_125": { x: 500.7, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_126": { x: 521.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_127": { x: 539.3, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_128": { x: 560.0, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_129": { x: 185.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_130": { x: 204.7, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_131": { x: 225.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_132": { x: 243.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_133": { x: 262.7, y: 464.7, w: 14.7, h: 14.7 },
  "Checkbox_134": { x: 283.3, y: 464.7, w: 14.7, h: 14.7 },
  "Checkbox_135": { x: 301.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_136": { x: 322.0, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_137": { x: 423.3, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_138": { x: 442.7, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_139": { x: 463.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_140": { x: 481.3, y: 466.0, w: 14.7, h: 14.7 },
  "Checkbox_141": { x: 500.7, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_142": { x: 521.3, y: 465.3, w: 14.7, h: 14.7 },
  "Checkbox_143": { x: 539.3, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_144": { x: 560.0, y: 466.7, w: 14.7, h: 14.7 },
  "Checkbox_145": { x: 186.0, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_146": { x: 205.3, y: 447.3, w: 14.7, h: 14.7 },
  "Checkbox_147": { x: 226.0, y: 447.3, w: 14.7, h: 14.7 },
  "Checkbox_148": { x: 244.0, y: 447.3, w: 14.7, h: 14.7 },
  "Checkbox_149": { x: 263.3, y: 446.7, w: 14.7, h: 14.7 },
  "Checkbox_150": { x: 284.0, y: 446.7, w: 14.7, h: 14.7 },
  "Checkbox_151": { x: 302.0, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_152": { x: 322.7, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_153": { x: 424.0, y: 448.7, w: 14.7, h: 14.7 },
  "Checkbox_154": { x: 443.3, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_155": { x: 464.0, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_156": { x: 482.0, y: 448.0, w: 14.7, h: 14.7 },
  "Checkbox_157": { x: 501.3, y: 447.3, w: 14.7, h: 14.7 },
  "Checkbox_158": { x: 522.0, y: 447.3, w: 14.7, h: 14.7 },
  "Checkbox_159": { x: 540.0, y: 448.7, w: 14.7, h: 14.7 },
  "Checkbox_160": { x: 560.7, y: 448.7, w: 14.7, h: 14.7 },
  "Checkbox_161": { x: 185.3, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_162": { x: 204.7, y: 430.7, w: 14.7, h: 14.7 },
  "Checkbox_163": { x: 225.3, y: 430.7, w: 14.7, h: 14.7 },
  "Checkbox_164": { x: 243.3, y: 430.7, w: 14.7, h: 14.7 },
  "Checkbox_165": { x: 262.7, y: 430.0, w: 14.7, h: 14.7 },
  "Checkbox_166": { x: 283.3, y: 430.0, w: 14.7, h: 14.7 },
  "Checkbox_167": { x: 301.3, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_168": { x: 322.0, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_169": { x: 423.3, y: 432.0, w: 14.7, h: 14.7 },
  "Checkbox_170": { x: 442.7, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_171": { x: 463.3, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_172": { x: 481.3, y: 431.3, w: 14.7, h: 14.7 },
  "Checkbox_173": { x: 500.7, y: 430.7, w: 14.7, h: 14.7 },
  "Checkbox_174": { x: 521.3, y: 430.7, w: 14.7, h: 14.7 },
  "Checkbox_175": { x: 539.3, y: 432.0, w: 14.7, h: 14.7 },
  "Checkbox_176": { x: 560.0, y: 432.0, w: 14.7, h: 14.7 },
  "Checkbox_177": { x: 186.0, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_178": { x: 205.3, y: 412.7, w: 14.7, h: 14.7 },
  "Checkbox_179": { x: 226.0, y: 412.7, w: 14.7, h: 14.7 },
  "Checkbox_180": { x: 244.0, y: 412.7, w: 14.7, h: 14.7 },
  "Checkbox_181": { x: 263.3, y: 412.0, w: 14.7, h: 14.7 },
  "Checkbox_182": { x: 284.0, y: 412.0, w: 14.7, h: 14.7 },
  "Checkbox_183": { x: 302.0, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_184": { x: 322.7, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_185": { x: 424.0, y: 414.0, w: 14.7, h: 14.7 },
  "Checkbox_186": { x: 443.3, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_187": { x: 464.0, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_188": { x: 482.0, y: 413.3, w: 14.7, h: 14.7 },
  "Checkbox_189": { x: 501.3, y: 412.7, w: 14.7, h: 14.7 },
  "Checkbox_190": { x: 522.0, y: 412.7, w: 14.7, h: 14.7 },
  "Checkbox_191": { x: 540.0, y: 414.0, w: 14.7, h: 14.7 },
  "Checkbox_192": { x: 560.7, y: 414.0, w: 14.7, h: 14.7 },
  "Checkbox_193": { x: 184.7, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_194": { x: 204.0, y: 392.7, w: 14.7, h: 14.7 },
  "Checkbox_195": { x: 224.7, y: 392.7, w: 14.7, h: 14.7 },
  "Checkbox_196": { x: 242.7, y: 392.7, w: 14.7, h: 14.7 },
  "Checkbox_197": { x: 262.0, y: 392.0, w: 14.7, h: 14.7 },
  "Checkbox_198": { x: 282.7, y: 392.0, w: 14.7, h: 14.7 },
  "Checkbox_199": { x: 300.7, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_200": { x: 321.3, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_201": { x: 422.7, y: 394.0, w: 14.7, h: 14.7 },
  "Checkbox_202": { x: 442.0, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_203": { x: 462.7, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_204": { x: 480.7, y: 393.3, w: 14.7, h: 14.7 },
  "Checkbox_205": { x: 500.0, y: 392.7, w: 14.7, h: 14.7 },
  "Checkbox_206": { x: 520.7, y: 392.7, w: 14.7, h: 14.7 },
  "Checkbox_207": { x: 538.7, y: 394.0, w: 14.7, h: 14.7 },
  "Checkbox_208": { x: 559.3, y: 394.0, w: 14.7, h: 14.7 },
  "Checkbox_209": { x: 185.3, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_210": { x: 204.7, y: 374.7, w: 14.7, h: 14.7 },
  "Checkbox_211": { x: 225.3, y: 374.7, w: 14.7, h: 14.7 },
  "Checkbox_212": { x: 243.3, y: 374.7, w: 14.7, h: 14.7 },
  "Checkbox_213": { x: 262.7, y: 374.0, w: 14.7, h: 14.7 },
  "Checkbox_214": { x: 283.3, y: 374.0, w: 14.7, h: 14.7 },
  "Checkbox_215": { x: 301.3, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_216": { x: 322.0, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_217": { x: 423.3, y: 376.0, w: 14.7, h: 14.7 },
  "Checkbox_218": { x: 442.7, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_219": { x: 463.3, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_220": { x: 481.3, y: 375.3, w: 14.7, h: 14.7 },
  "Checkbox_221": { x: 500.7, y: 374.7, w: 14.7, h: 14.7 },
  "Checkbox_222": { x: 521.3, y: 374.7, w: 14.7, h: 14.7 },
  "Checkbox_223": { x: 539.3, y: 376.0, w: 14.7, h: 14.7 },
  "Checkbox_224": { x: 560.0, y: 376.0, w: 14.7, h: 14.7 },
  "Checkbox_225": { x: 184.7, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_226": { x: 204.0, y: 358.0, w: 14.7, h: 14.7 },
  "Checkbox_227": { x: 224.7, y: 358.0, w: 14.7, h: 14.7 },
  "Checkbox_228": { x: 242.7, y: 358.0, w: 14.7, h: 14.7 },
  "Checkbox_229": { x: 262.0, y: 357.3, w: 14.7, h: 14.7 },
  "Checkbox_230": { x: 282.7, y: 357.3, w: 14.7, h: 14.7 },
  "Checkbox_231": { x: 300.7, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_232": { x: 321.3, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_233": { x: 422.7, y: 359.3, w: 14.7, h: 14.7 },
  "Checkbox_234": { x: 442.0, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_235": { x: 462.7, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_236": { x: 480.7, y: 358.7, w: 14.7, h: 14.7 },
  "Checkbox_237": { x: 500.0, y: 358.0, w: 14.7, h: 14.7 },
  "Checkbox_238": { x: 520.7, y: 358.0, w: 14.7, h: 14.7 },
  "Checkbox_239": { x: 538.7, y: 359.3, w: 14.7, h: 14.7 },
  "Checkbox_240": { x: 559.3, y: 359.3, w: 14.7, h: 14.7 },
  "Checkbox_241": { x: 185.3, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_242": { x: 204.7, y: 340.0, w: 14.7, h: 14.7 },
  "Checkbox_243": { x: 225.3, y: 340.0, w: 14.7, h: 14.7 },
  "Checkbox_244": { x: 243.3, y: 340.0, w: 14.7, h: 14.7 },
  "Checkbox_245": { x: 262.7, y: 339.3, w: 14.7, h: 14.7 },
  "Checkbox_246": { x: 283.3, y: 339.3, w: 14.7, h: 14.7 },
  "Checkbox_247": { x: 301.3, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_248": { x: 322.0, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_249": { x: 423.3, y: 341.3, w: 14.7, h: 14.7 },
  "Checkbox_250": { x: 442.7, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_251": { x: 463.3, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_252": { x: 481.3, y: 340.7, w: 14.7, h: 14.7 },
  "Checkbox_253": { x: 500.7, y: 340.0, w: 14.7, h: 14.7 },
  "Checkbox_254": { x: 521.3, y: 340.0, w: 14.7, h: 14.7 },
  "Checkbox_255": { x: 539.3, y: 341.3, w: 14.7, h: 14.7 },
  "Checkbox_256": { x: 560.0, y: 341.3, w: 14.7, h: 14.7 },
  "Checkbox_257": { x: 184.7, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_258": { x: 204.0, y: 300.7, w: 14.7, h: 14.7 },
  "Checkbox_259": { x: 224.7, y: 300.7, w: 14.7, h: 14.7 },
  "Checkbox_260": { x: 242.7, y: 300.7, w: 14.7, h: 14.7 },
  "Checkbox_261": { x: 262.0, y: 300.0, w: 14.7, h: 14.7 },
  "Checkbox_262": { x: 282.7, y: 300.0, w: 14.7, h: 14.7 },
  "Checkbox_263": { x: 300.7, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_264": { x: 321.3, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_265": { x: 422.7, y: 302.0, w: 14.7, h: 14.7 },
  "Checkbox_266": { x: 442.0, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_267": { x: 462.7, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_268": { x: 480.7, y: 301.3, w: 14.7, h: 14.7 },
  "Checkbox_269": { x: 500.0, y: 300.7, w: 14.7, h: 14.7 },
  "Checkbox_270": { x: 520.7, y: 300.7, w: 14.7, h: 14.7 },
  "Checkbox_271": { x: 538.7, y: 302.0, w: 14.7, h: 14.7 },
  "Checkbox_272": { x: 559.3, y: 302.0, w: 14.7, h: 14.7 },
  "Checkbox_273": { x: 185.3, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_274": { x: 204.7, y: 282.7, w: 14.7, h: 14.7 },
  "Checkbox_275": { x: 225.3, y: 282.7, w: 14.7, h: 14.7 },
  "Checkbox_276": { x: 243.3, y: 282.7, w: 14.7, h: 14.7 },
  "Checkbox_277": { x: 262.7, y: 282.0, w: 14.7, h: 14.7 },
  "Checkbox_278": { x: 283.3, y: 282.0, w: 14.7, h: 14.7 },
  "Checkbox_279": { x: 301.3, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_280": { x: 322.0, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_281": { x: 423.3, y: 284.0, w: 14.7, h: 14.7 },
  "Checkbox_282": { x: 442.7, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_283": { x: 463.3, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_284": { x: 481.3, y: 283.3, w: 14.7, h: 14.7 },
  "Checkbox_285": { x: 500.7, y: 282.7, w: 14.7, h: 14.7 },
  "Checkbox_286": { x: 521.3, y: 282.7, w: 14.7, h: 14.7 },
  "Checkbox_287": { x: 539.3, y: 284.0, w: 14.7, h: 14.7 },
  "Checkbox_288": { x: 560.0, y: 284.0, w: 14.7, h: 14.7 },
  "Checkbox_289": { x: 184.7, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_290": { x: 204.0, y: 266.0, w: 14.7, h: 14.7 },
  "Checkbox_291": { x: 224.7, y: 266.0, w: 14.7, h: 14.7 },
  "Checkbox_292": { x: 242.7, y: 266.0, w: 14.7, h: 14.7 },
  "Checkbox_293": { x: 262.0, y: 265.3, w: 14.7, h: 14.7 },
  "Checkbox_294": { x: 282.7, y: 265.3, w: 14.7, h: 14.7 },
  "Checkbox_295": { x: 300.7, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_296": { x: 321.3, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_297": { x: 422.7, y: 267.3, w: 14.7, h: 14.7 },
  "Checkbox_298": { x: 442.0, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_299": { x: 462.7, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_300": { x: 480.7, y: 266.7, w: 14.7, h: 14.7 },
  "Checkbox_301": { x: 500.0, y: 266.0, w: 14.7, h: 14.7 },
  "Checkbox_302": { x: 520.7, y: 266.0, w: 14.7, h: 14.7 },
  "Checkbox_303": { x: 538.7, y: 267.3, w: 14.7, h: 14.7 },
  "Checkbox_304": { x: 559.3, y: 267.3, w: 14.7, h: 14.7 },
  "Checkbox_305": { x: 185.3, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_306": { x: 204.7, y: 248.0, w: 14.7, h: 14.7 },
  "Checkbox_307": { x: 225.3, y: 248.0, w: 14.7, h: 14.7 },
  "Checkbox_308": { x: 243.3, y: 248.0, w: 14.7, h: 14.7 },
  "Checkbox_309": { x: 262.7, y: 247.3, w: 14.7, h: 14.7 },
  "Checkbox_310": { x: 283.3, y: 247.3, w: 14.7, h: 14.7 },
  "Checkbox_311": { x: 301.3, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_312": { x: 322.0, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_313": { x: 423.3, y: 249.3, w: 14.7, h: 14.7 },
  "Checkbox_314": { x: 442.7, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_315": { x: 463.3, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_316": { x: 481.3, y: 248.7, w: 14.7, h: 14.7 },
  "Checkbox_317": { x: 500.7, y: 248.0, w: 14.7, h: 14.7 },
  "Checkbox_318": { x: 521.3, y: 248.0, w: 14.7, h: 14.7 },
  "Checkbox_319": { x: 539.3, y: 249.3, w: 14.7, h: 14.7 },
  "Checkbox_320": { x: 560.0, y: 249.3, w: 14.7, h: 14.7 },
  "Checkbox_321": { x: 184.0, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_322": { x: 203.3, y: 228.0, w: 14.7, h: 14.7 },
  "Checkbox_323": { x: 224.0, y: 228.0, w: 14.7, h: 14.7 },
  "Checkbox_324": { x: 242.0, y: 228.0, w: 14.7, h: 14.7 },
  "Checkbox_325": { x: 261.3, y: 227.3, w: 14.7, h: 14.7 },
  "Checkbox_326": { x: 282.0, y: 227.3, w: 14.7, h: 14.7 },
  "Checkbox_327": { x: 300.0, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_328": { x: 320.7, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_329": { x: 422.0, y: 229.3, w: 14.7, h: 14.7 },
  "Checkbox_330": { x: 441.3, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_331": { x: 462.0, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_332": { x: 480.0, y: 228.7, w: 14.7, h: 14.7 },
  "Checkbox_333": { x: 499.3, y: 228.0, w: 14.7, h: 14.7 },
  "Checkbox_334": { x: 520.0, y: 228.0, w: 14.7, h: 14.7 },
  "Checkbox_335": { x: 538.0, y: 229.3, w: 14.7, h: 14.7 },
  "Checkbox_336": { x: 558.7, y: 229.3, w: 14.7, h: 14.7 },
  "Checkbox_337": { x: 184.7, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_338": { x: 204.0, y: 210.0, w: 14.7, h: 14.7 },
  "Checkbox_339": { x: 224.7, y: 210.0, w: 14.7, h: 14.7 },
  "Checkbox_340": { x: 242.7, y: 210.0, w: 14.7, h: 14.7 },
  "Checkbox_341": { x: 262.0, y: 209.3, w: 14.7, h: 14.7 },
  "Checkbox_342": { x: 282.7, y: 209.3, w: 14.7, h: 14.7 },
  "Checkbox_343": { x: 300.7, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_344": { x: 321.3, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_345": { x: 422.7, y: 211.3, w: 14.7, h: 14.7 },
  "Checkbox_346": { x: 442.0, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_347": { x: 462.7, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_348": { x: 480.7, y: 210.7, w: 14.7, h: 14.7 },
  "Checkbox_349": { x: 500.0, y: 210.0, w: 14.7, h: 14.7 },
  "Checkbox_350": { x: 520.7, y: 210.0, w: 14.7, h: 14.7 },
  "Checkbox_351": { x: 538.7, y: 211.3, w: 14.7, h: 14.7 },
  "Checkbox_352": { x: 559.3, y: 211.3, w: 14.7, h: 14.7 },
  "Checkbox_353": { x: 184.0, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_354": { x: 203.3, y: 193.3, w: 14.7, h: 14.7 },
  "Checkbox_355": { x: 224.0, y: 193.3, w: 14.7, h: 14.7 },
  "Checkbox_356": { x: 242.0, y: 193.3, w: 14.7, h: 14.7 },
  "Checkbox_357": { x: 261.3, y: 192.7, w: 14.7, h: 14.7 },
  "Checkbox_358": { x: 282.0, y: 192.7, w: 14.7, h: 14.7 },
  "Checkbox_359": { x: 300.0, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_360": { x: 320.7, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_361": { x: 422.0, y: 194.7, w: 14.7, h: 14.7 },
  "Checkbox_362": { x: 441.3, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_363": { x: 462.0, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_364": { x: 480.0, y: 194.0, w: 14.7, h: 14.7 },
  "Checkbox_365": { x: 499.3, y: 193.3, w: 14.7, h: 14.7 },
  "Checkbox_366": { x: 520.0, y: 193.3, w: 14.7, h: 14.7 },
  "Checkbox_367": { x: 538.0, y: 194.7, w: 14.7, h: 14.7 },
  "Checkbox_368": { x: 558.7, y: 194.7, w: 14.7, h: 14.7 },
  "Checkbox_369": { x: 184.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_370": { x: 204.0, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_371": { x: 224.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_372": { x: 242.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_373": { x: 262.0, y: 174.7, w: 14.7, h: 14.7 },
  "Checkbox_374": { x: 282.7, y: 174.7, w: 14.7, h: 14.7 },
  "Checkbox_375": { x: 300.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_376": { x: 321.3, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_377": { x: 422.7, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_378": { x: 442.0, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_379": { x: 462.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_380": { x: 480.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_381": { x: 500.0, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_382": { x: 520.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_383": { x: 538.7, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_384": { x: 559.3, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_385": { x: 184.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_386": { x: 204.0, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_387": { x: 224.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_388": { x: 242.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_389": { x: 262.0, y: 174.7, w: 14.7, h: 14.7 },
  "Checkbox_390": { x: 282.7, y: 174.7, w: 14.7, h: 14.7 },
  "Checkbox_391": { x: 300.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_392": { x: 321.3, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_393": { x: 422.7, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_394": { x: 442.0, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_395": { x: 462.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_396": { x: 480.7, y: 176.0, w: 14.7, h: 14.7 },
  "Checkbox_397": { x: 500.0, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_398": { x: 520.7, y: 175.3, w: 14.7, h: 14.7 },
  "Checkbox_399": { x: 538.7, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_400": { x: 559.3, y: 176.7, w: 14.7, h: 14.7 },
  "Checkbox_401": { x: 185.3, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_402": { x: 204.7, y: 157.3, w: 14.7, h: 14.7 },
  "Checkbox_403": { x: 225.3, y: 157.3, w: 14.7, h: 14.7 },
  "Checkbox_404": { x: 243.3, y: 157.3, w: 14.7, h: 14.7 },
  "Checkbox_405": { x: 262.7, y: 156.7, w: 14.7, h: 14.7 },
  "Checkbox_406": { x: 283.3, y: 156.7, w: 14.7, h: 14.7 },
  "Checkbox_407": { x: 301.3, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_408": { x: 322.0, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_409": { x: 423.3, y: 158.7, w: 14.7, h: 14.7 },
  "Checkbox_410": { x: 442.7, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_411": { x: 463.3, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_412": { x: 481.3, y: 158.0, w: 14.7, h: 14.7 },
  "Checkbox_413": { x: 500.7, y: 157.3, w: 14.7, h: 14.7 },
  "Checkbox_414": { x: 521.3, y: 157.3, w: 14.7, h: 14.7 },
  "Checkbox_415": { x: 539.3, y: 158.7, w: 14.7, h: 14.7 },
  "Checkbox_416": { x: 560.0, y: 158.7, w: 14.7, h: 14.7 },
  "Checkbox_417": { x: 184.7, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_418": { x: 204.0, y: 140.7, w: 14.7, h: 14.7 },
  "Checkbox_419": { x: 224.7, y: 140.7, w: 14.7, h: 14.7 },
  "Checkbox_420": { x: 242.7, y: 140.7, w: 14.7, h: 14.7 },
  "Checkbox_421": { x: 262.0, y: 140.0, w: 14.7, h: 14.7 },
  "Checkbox_422": { x: 282.7, y: 140.0, w: 14.7, h: 14.7 },
  "Checkbox_423": { x: 300.7, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_424": { x: 321.3, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_425": { x: 422.7, y: 142.0, w: 14.7, h: 14.7 },
  "Checkbox_426": { x: 442.0, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_427": { x: 462.7, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_428": { x: 480.7, y: 141.3, w: 14.7, h: 14.7 },
  "Checkbox_429": { x: 500.0, y: 140.7, w: 14.7, h: 14.7 },
  "Checkbox_430": { x: 520.7, y: 140.7, w: 14.7, h: 14.7 },
  "Checkbox_431": { x: 538.7, y: 142.0, w: 14.7, h: 14.7 },
  "Checkbox_432": { x: 559.3, y: 142.0, w: 14.7, h: 14.7 },
  "Checkbox_433": { x: 185.3, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_434": { x: 204.7, y: 122.7, w: 14.7, h: 14.7 },
  "Checkbox_435": { x: 225.3, y: 122.7, w: 14.7, h: 14.7 },
  "Checkbox_436": { x: 243.3, y: 122.7, w: 14.7, h: 14.7 },
  "Checkbox_437": { x: 262.7, y: 122.0, w: 14.7, h: 14.7 },
  "Checkbox_438": { x: 283.3, y: 122.0, w: 14.7, h: 14.7 },
  "Checkbox_439": { x: 301.3, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_440": { x: 322.0, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_441": { x: 423.3, y: 124.0, w: 14.7, h: 14.7 },
  "Checkbox_442": { x: 442.7, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_443": { x: 463.3, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_444": { x: 481.3, y: 123.3, w: 14.7, h: 14.7 },
  "Checkbox_445": { x: 500.7, y: 122.7, w: 14.7, h: 14.7 },
  "Checkbox_446": { x: 521.3, y: 122.7, w: 14.7, h: 14.7 },
  "Checkbox_447": { x: 539.3, y: 124.0, w: 14.7, h: 14.7 },
  "Checkbox_448": { x: 560.0, y: 124.0, w: 14.7, h: 14.7 },
  "Checkbox_449": { x: 184.0, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_450": { x: 203.3, y: 102.7, w: 14.7, h: 14.7 },
  "Checkbox_451": { x: 224.0, y: 102.7, w: 14.7, h: 14.7 },
  "Checkbox_452": { x: 242.0, y: 102.7, w: 14.7, h: 14.7 },
  "Checkbox_453": { x: 261.3, y: 102.0, w: 14.7, h: 14.7 },
  "Checkbox_454": { x: 282.0, y: 102.0, w: 14.7, h: 14.7 },
  "Checkbox_455": { x: 300.0, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_456": { x: 320.7, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_457": { x: 422.0, y: 104.0, w: 14.7, h: 14.7 },
  "Checkbox_458": { x: 441.3, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_459": { x: 462.0, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_460": { x: 480.0, y: 103.3, w: 14.7, h: 14.7 },
  "Checkbox_461": { x: 499.3, y: 102.7, w: 14.7, h: 14.7 },
  "Checkbox_462": { x: 520.0, y: 102.7, w: 14.7, h: 14.7 },
  "Checkbox_463": { x: 538.0, y: 104.0, w: 14.7, h: 14.7 },
  "Checkbox_464": { x: 558.7, y: 104.0, w: 14.7, h: 14.7 },
  "Checkbox_465": { x: 184.7, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_466": { x: 204.0, y: 84.7, w: 14.7, h: 14.7 },
  "Checkbox_467": { x: 224.7, y: 84.7, w: 14.7, h: 14.7 },
  "Checkbox_468": { x: 242.7, y: 84.7, w: 14.7, h: 14.7 },
  "Checkbox_469": { x: 262.0, y: 84.0, w: 14.7, h: 14.7 },
  "Checkbox_470": { x: 282.7, y: 84.0, w: 14.7, h: 14.7 },
  "Checkbox_471": { x: 300.7, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_472": { x: 321.3, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_473": { x: 422.7, y: 86.0, w: 14.7, h: 14.7 },
  "Checkbox_474": { x: 442.0, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_475": { x: 462.7, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_476": { x: 480.7, y: 85.3, w: 14.7, h: 14.7 },
  "Checkbox_477": { x: 500.0, y: 84.7, w: 14.7, h: 14.7 },
  "Checkbox_478": { x: 520.7, y: 84.7, w: 14.7, h: 14.7 },
  "Checkbox_479": { x: 538.7, y: 86.0, w: 14.7, h: 14.7 },
  "Checkbox_480": { x: 559.3, y: 86.0, w: 14.7, h: 14.7 },
  "Checkbox_481": { x: 184.0, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_482": { x: 203.3, y: 68.0, w: 14.7, h: 14.7 },
  "Checkbox_483": { x: 224.0, y: 68.0, w: 14.7, h: 14.7 },
  "Checkbox_484": { x: 242.0, y: 68.0, w: 14.7, h: 14.7 },
  "Checkbox_485": { x: 261.3, y: 67.3, w: 14.7, h: 14.7 },
  "Checkbox_486": { x: 282.0, y: 67.3, w: 14.7, h: 14.7 },
  "Checkbox_487": { x: 300.0, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_488": { x: 320.7, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_489": { x: 422.0, y: 69.3, w: 14.7, h: 14.7 },
  "Checkbox_490": { x: 441.3, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_491": { x: 462.0, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_492": { x: 480.0, y: 68.7, w: 14.7, h: 14.7 },
  "Checkbox_493": { x: 499.3, y: 68.0, w: 14.7, h: 14.7 },
  "Checkbox_494": { x: 520.0, y: 68.0, w: 14.7, h: 14.7 },
  "Checkbox_495": { x: 538.0, y: 69.3, w: 14.7, h: 14.7 },
  "Checkbox_496": { x: 558.7, y: 69.3, w: 14.7, h: 14.7 },
  "Checkbox_497": { x: 184.7, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_498": { x: 204.0, y: 50.0, w: 14.7, h: 14.7 },
  "Checkbox_499": { x: 224.7, y: 50.0, w: 14.7, h: 14.7 },
  "Checkbox_500": { x: 242.7, y: 50.0, w: 14.7, h: 14.7 },
  "Checkbox_501": { x: 262.0, y: 49.3, w: 14.7, h: 14.7 },
  "Checkbox_502": { x: 282.7, y: 49.3, w: 14.7, h: 14.7 },
  "Checkbox_503": { x: 300.7, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_504": { x: 321.3, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_505": { x: 422.7, y: 51.3, w: 14.7, h: 14.7 },
  "Checkbox_506": { x: 442.0, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_507": { x: 462.7, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_508": { x: 480.7, y: 50.7, w: 14.7, h: 14.7 },
  "Checkbox_509": { x: 500.0, y: 50.0, w: 14.7, h: 14.7 },
  "Checkbox_510": { x: 520.7, y: 50.0, w: 14.7, h: 14.7 },
  "Checkbox_511": { x: 538.7, y: 51.3, w: 14.7, h: 14.7 },
  "Checkbox_512": { x: 559.3, y: 51.3, w: 14.7, h: 14.7 }
};

// Draw checkmarks on the PDF page for the download version.
// Uses hardcoded positions extracted from dental-form.pdf — bypasses
// ZapfDingbats font and unreliable widget.getRectangle() calls.
function drawCheckmarksOnPage(page, pdfDoc, form, data, fieldNames) {
  for (const name of fieldNames) {
    if (!data[name]) continue;
    const pos = DEF_CHECKBOX_POSITIONS[name];
    if (!pos) continue;
    const { x, y, w, h } = pos;
    const thickness = Math.max(1.0, Math.min(w, h) * 0.18);
    page.drawLine({
      start: { x: x + w * 0.1,  y: y + h * 0.45 },
      end:   { x: x + w * 0.4,  y: y + h * 0.15 },
      thickness, color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: x + w * 0.4,  y: y + h * 0.15 },
      end:   { x: x + w * 0.9,  y: y + h * 0.82 },
      thickness, color: rgb(0, 0, 0),
    });
  }
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

// ── Tooth chart structured data helpers ─────────────────────────────────────
// Maps Checkbox_N -> { quadrant, row, tooth } using sequential math:
// Checkbox 1..240 = upper section, 241..480 = lower section
// Every 16 = one condition row; 1..8 = right quadrant, 9..16 = left quadrant
const TOOTH_ROW_LABELS = ["WithCaries","Amalgam","LC","OtherRestoMat","PLJC","PoJC",
  "Pontic","Missing","RF","Unerupted","ForExo","TF","Abutment","RCT","Impacted"];
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

// Convert flat { Checkbox_1: true, ... } to structured toothChart
function flatToStructured(checks) {
  const tc = emptyToothChart();
  for (let n = 1; n <= 480; n++) {
    const val = checks[`Checkbox_${n}`];
    if (!val) continue;
    const info = getCheckboxInfo(n);
    if (info) tc[info.quadrant][info.row][info.tooth - 1] = true;
  }
  return tc;
}

// Convert structured toothChart back to flat { Checkbox_1: true, ... }
function structuredToFlat(toothChart) {
  const result = {};
  for (let n = 1; n <= 480; n++) {
    const info = getCheckboxInfo(n);
    if (!info) continue;
    result[`Checkbox_${n}`] = !!(toothChart?.[info.quadrant]?.[info.row]?.[info.tooth - 1]);
  }
  return result;
}

// GET /api/hso/students/:id/def — get student's DEF form data (for nurse to view)
router.get("/students/:id/def", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Student not found." });

    const form = await Form.findOne({ userId: req.params.id, formType: "def" });
    const autofill = await autofillDefMeta(req);

    const studentName = [user.firstName, user.middleInitial, user.lastName].filter(Boolean).join(" ");
    const { toothChart, ...otherFormData } = form?.formData || {};

    // Expand structured toothChart back to flat Checkbox_N for the frontend
    const flatCheckboxes = toothChart ? structuredToFlat(toothChart) : {};

    const formData = {
      ...autofill,
      ...otherFormData,
      ...flatCheckboxes,
      "Name":  studentName  || otherFormData["Name"]  || "",
      "ID No": user.studentId || otherFormData["ID No"] || "",
    };

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

    // Separate tooth chart checkboxes from other form fields
    const { toothChart: existingToothChart, ...existingOther } = existing?.formData || {};
    const checkboxFields = {};
    const otherFields = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (k.startsWith("Checkbox_")) checkboxFields[k] = v;
      else otherFields[k] = v;
    }

    // Convert flat Checkbox_N to structured toothChart for clean MongoDB storage
    const incomingToothChart = flatToStructured(checkboxFields);

    // Merge toothChart deeply (per quadrant/row)
    const mergedToothChart = existingToothChart ? { ...existingToothChart } : emptyToothChart();
    for (const q of TOOTH_QUADRANTS) {
      for (const r of TOOTH_ROW_LABELS) {
        if (incomingToothChart[q]?.[r]) {
          mergedToothChart[q] = mergedToothChart[q] || {};
          mergedToothChart[q][r] = incomingToothChart[q][r];
        }
      }
    }

    const mergedData = { ...existingOther, ...otherFields, toothChart: mergedToothChart };

    await Form.findOneAndUpdate(
      { userId: req.params.id, formType: "def" },
      { userId: req.params.id, formType: "def", formData: mergedData },
      { upsert: true, new: true }
    );

    user.filledDEF = true;
    await user.save();

    // Send email notification (non-blocking — never crashes the request)
    const nurse = await User.findById(req.user.id).select("firstName lastName");
    const academicYear = mergedData["Academic Year"] || "";
    sendDEFFilledEmail(user, nurse, { academicYear }).catch(() => {});

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

    // NOT flattened — keeps AcroForm alive so the annotation layer can render.
    // updateFieldAppearances: false — avoids baking field text onto the
    // canvas so it won't double up with the frontend's LiveFieldOverlay.
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

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

    // Expand structured toothChart to flat Checkbox_N, merge with req.body
    const { toothChart, ...savedOther } = existing?.formData || {};
    const savedFlat = toothChart ? structuredToFlat(toothChart) : {};
    const data = { ...autofill, ...savedOther, ...savedFlat, ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    // Fill text fields
    DEF_TEXT_FIELD_NAMES.forEach(name => {
      try { form.getTextField(name).setText(data[name] || ""); } catch (_) {}
    });

    // Draw checkmarks manually — avoids ZapfDingbats font dependency
    const page = pdfDoc.getPages()[0];
    drawCheckmarksOnPage(page, pdfDoc, form, data, DEF_CHECKBOX_FIELD_NAMES);

    try { form.flatten(); } catch (_) {}
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

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