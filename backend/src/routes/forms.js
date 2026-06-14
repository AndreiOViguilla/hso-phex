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
    // updateFieldAppearances: false avoids baking field text onto the canvas,
    // which would double up with the frontend's LiveFieldOverlay (which now
    // renders live values instantly on top of the canvas).
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

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
    // updateFieldAppearances: false avoids baking field text onto the canvas,
    // which would double up with the frontend's LiveFieldOverlay.
    const bytes = await pdfDoc.save({ updateFieldAppearances: false });

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