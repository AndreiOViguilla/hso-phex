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

// POST /api/hso/students/:id/mef/pdf/download — FLATTENED final PDF for download
router.post("/students/:id/mef/pdf/download", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, "../../public/medical-examination-form.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "MEF PDF template not found on server." });

    const existing = await Form.findOne({ userId: req.params.id, formType: "mef" });
    const data = { ...(existing?.formData || {}), ...req.body };

    const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    fillMefForm(form, data);

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

// Draw checkmarks manually on the PDF page for the download version,
// bypassing the ZapfDingbats font that's unavailable in the server environment.
function drawCheckmarksOnPage(page, pdfDoc, form, data, fieldNames) {
  for (const name of fieldNames) {
    if (!data[name]) continue;
    try {
      const field = form.getCheckBox(name);
      const widgets = field.acroField.getWidgets();
      for (const widget of widgets) {
        const { x, y, width: w, height: h } = widget.getRectangle();
        const thickness = Math.max(0.5, Math.min(w, h) * 0.1);
        // ✓: short down-left leg then long up-right leg
        page.drawLine({
          start: { x: x + w * 0.1,  y: y + h * 0.4 },
          end:   { x: x + w * 0.4,  y: y + h * 0.15 },
          thickness, color: rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x: x + w * 0.4,  y: y + h * 0.15 },
          end:   { x: x + w * 0.9,  y: y + h * 0.8 },
          thickness, color: rgb(0, 0, 0),
        });
      }
    } catch (_) {}
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

// GET /api/hso/students/:id/def — get student's DEF form data (for nurse to view)
router.get("/students/:id/def", authMiddleware, requireRole("admin", "master", "nurse"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Student not found." });

    const form = await Form.findOne({ userId: req.params.id, formType: "def" });
    const autofill = await autofillDefMeta(req);

    // Always populate Name/ID No from the student's actual user record,
    // so the nurse preview shows the correct student even if the student
    // hasn't submitted their own DEF form yet.
    const studentName = [user.firstName, user.middleInitial, user.lastName]
      .filter(Boolean).join(" ");
    const formData = {
      ...autofill,
      ...(form?.formData || {}),
      "Name":  studentName  || form?.formData?.["Name"]  || "",
      "ID No": user.studentId || form?.formData?.["ID No"] || "",
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
    const data = { ...autofill, ...(existing?.formData || {}), ...req.body };

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