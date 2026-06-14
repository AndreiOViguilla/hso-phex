import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { useIsMobile } from "../utils/useIsMobile";
import { renderFieldOwnerTooltips } from "../fieldOwnerTooltips";
import LiveFieldOverlay, { useLiveFieldOverlay } from "../useLiveFieldOverlay";

const DEF_STUDENT_FIELDS = new Set(["Name", "ID No"]);
function getDefFieldOwner(fieldName) {
  return DEF_STUDENT_FIELDS.has(fieldName) ? "Student" : "Nurse";
}

const ASSESSMENT_TEXT_FIELDS = [
  { key: "Assigned Dentist", label: "Assigned Dentist" },
  { key: "Date",             label: "Date" },
  { key: "Academic Year",    label: "Academic Year" },
];

const REMARKS_FIELDS = [
  { key: "Other Remarks 1", label: "Other Remarks 1" },
  { key: "Other Remarks 2", label: "Other Remarks 2" },
  { key: "Other Remarks 3", label: "Other Remarks 3" },
  { key: "Other Remarks 4", label: "Other Remarks 4" },
];

const OTHERS_TEXT_FIELD = { key: "Others Text", label: "Others (specify)" };

const ORAL_HEALTH_CHECKBOXES = [
  "Good oral hygiene",
  "Calcular deposits",
  "Gingivitis",
  "Pyorrheatic",
];

const DENTURE_PAIRS = [
  { label: "Denture wearer", up: "Denture wearer up", down: "Denture wearer down" },
  { label: "Ortho braces",   up: "Ortho braces up",    down: "Ortho braces down" },
];

const HAWLEYS_CHECKBOX = "Hawleys retainers";

// All interactive checkboxes: named oral health + all tooth chart boxes
const INTERACTIVE_CHECKBOXES = new Set([
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
            "Checkbox_480"
]);

function SectionCard({ title, children, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "16px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, t, multiline, readOnly }) {
  const style = {
    width: "100%", padding: "9px 12px", border: `1px solid ${readOnly ? t.cardBorder : t.inputBorder}`,
    borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    background: readOnly ? t.bg : t.input, color: readOnly ? t.textMuted : t.text,
    resize: multiline ? "vertical" : undefined, minHeight: multiline ? 60 : undefined,
  };
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
      {multiline ? (
        <textarea style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
      ) : (
        <input style={style} value={value || ""} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
      )}
    </div>
  );
}

export default function NurseDEFPage({ studentMongoId, onBack, onSaved }) {
  const { t } = useTheme();
  const { show } = useModal();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentFields, setStudentFields] = useState({});
  const [form, setForm] = useState({});
  const [checks, setChecks] = useState({});

  const canvasRef = useRef(null);
  const annotationLayerRef = useRef(null);
  const tooltipLayerRef = useRef(null);
  const clickLayerRef = useRef(null);
  const pdfDocRef = useRef(null);
  const scaleRef  = useRef(1);
  const requestIdRef = useRef(0);
  const checkboxElementsRef = useRef({});
  const checksRef = useRef({});

  const [pdfReady, setPdfReady] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [pdfVersion, setPdfVersion] = useState(0);
  const [overlayDims, setOverlayDims] = useState({ width: 0, height: 0 });
  const { fieldRects, captureFieldRects } = useLiveFieldOverlay();

  useEffect(() => {
    fetch(`/api/hso/students/${studentMongoId}/def`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return; }
        setStudentInfo(data.student);
        const fd = data.formData || {};
        setStudentFields({ "Name": fd["Name"] || "", "ID No": fd["ID No"] || "" });

        const nurseVals = {};
        [...ASSESSMENT_TEXT_FIELDS.map(f => f.key), ...REMARKS_FIELDS.map(f => f.key), OTHERS_TEXT_FIELD.key]
          .forEach(k => { nurseVals[k] = fd[k] || ""; });
        setForm(nurseVals);

        const checkVals = {};
        const allCheckKeys = [
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
          "Checkbox_480"
        ];
        allCheckKeys.forEach(k => { checkVals[k] = !!fd[k]; });
        setChecks(checkVals);

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentMongoId]);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCheck = useCallback((key, value) => setChecks(c => ({ ...c, [key]: value })), []);

  // Keep checksRef current so click handlers don't capture stale closure
  useEffect(() => { checksRef.current = checks; }, [checks]);

  // Sync checkbox DOM elements visual state instantly when checks state changes
  useEffect(() => {
    const map = checkboxElementsRef.current;
    if (!map || Object.keys(map).length === 0) return;
    Object.entries(checks).forEach(([name, value]) => {
      const el = map[name];
      if (el && el.type === "checkbox" && el.checked !== !!value) {
        el.checked = !!value;
      }
    });
  }, [checks]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, ...checks };
      const r = await fetch(`/api/hso/students/${studentMongoId}/def`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        show({ type: "success", message: "DEF saved and marked as filled." });
        if (onSaved) onSaved();
      } else {
        show({ type: "error", message: "Failed to save DEF." });
      }
    } catch (_) { show({ type: "error", message: "Server error." }); }
    setSaving(false);
  };

  useEffect(() => {
    const ensurePdfJs = async () => {
      if (!document.getElementById("pdfjs-annotation-css")) {
        const link = document.createElement("link");
        link.id = "pdfjs-annotation-css";
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";
        document.head.appendChild(link);
      }
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      if (!window.pdfjsViewer) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
    };
    ensurePdfJs();
  }, []);

  const loadFilledPdf = useCallback(async () => {
    if (!window.pdfjsLib) return;
    const reqId = ++requestIdRef.current;
    setRendering(true);
    try {
      const payload = { ...form, ...checks };
      const resp = await fetch(`/api/hso/students/${studentMongoId}/def/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("not found");
      const buf = await resp.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
      if (reqId !== requestIdRef.current) return;
      pdfDocRef.current = doc;
      setPdfReady(true);
      setPdfError(false);
      setPdfVersion(v => v + 1);
    } catch (e) {
      if (reqId === requestIdRef.current) setPdfError(true);
    }
    if (reqId === requestIdRef.current) setRendering(false);
  }, [form, checks, studentMongoId]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => { loadFilledPdf(); }, 350);
    return () => clearTimeout(timer);
  }, [form, checks, loading, loadFilledPdf]);

  const renderPreview = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(1);
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const previewPanel = container?.parentElement;
      const panelW = (previewPanel?.clientWidth || canvas.parentElement?.clientWidth || 700) - 24;
      const pdfNatural = page.getViewport({ scale: 1 });
      const baseWidth = Math.max(panelW, 280);
      const fitWidth = baseWidth * zoom;
      const fitScale = fitWidth / pdfNatural.width;
      const renderScale = fitScale * Math.max(dpr, 2);
      scaleRef.current = renderScale;

      const viewport = page.getViewport({ scale: renderScale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width   = `${fitWidth}px`;
      canvas.style.height  = `${pdfNatural.height * fitScale}px`;
      canvas.style.display = "block";
      canvas.style.margin  = zoom <= 1 ? "0 auto" : "0";
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      const fitHeight = pdfNatural.height * fitScale;
      const cssViewport = page.getViewport({ scale: fitScale });

      setOverlayDims({ width: fitWidth, height: fitHeight });
      await captureFieldRects(page, cssViewport, fitScale);

      const annotationDiv = annotationLayerRef.current;
      if (annotationDiv && window.pdfjsViewer) {
        annotationDiv.innerHTML = "";
        annotationDiv.style.width  = `${fitWidth}px`;
        annotationDiv.style.height = `${fitHeight}px`;
        annotationDiv.style.margin = zoom <= 1 ? "0 auto" : "0";
        try {
          const annotations = await page.getAnnotations({ intent: "display" });
          const linkService = {
            getDestinationHash: () => "#",
            getAnchorUrl: () => "#",
            addLinkAttributes: () => {},
            executeNamedAction: () => {},
            isPageVisible: () => true,
            eventBus: new window.pdfjsViewer.EventBus(),
          };
          window.pdfjsViewer.AnnotationLayer.render({
            viewport: cssViewport.clone({ dontFlip: true }),
            div: annotationDiv,
            annotations,
            page,
            renderForms: true,
            linkService,
            downloadManager: null,
            imageResourcesPath: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/web/images/",
          });

          // Disable ALL annotation widgets — no clicking or typing in them
          annotationDiv.querySelectorAll("input, textarea, select, section")
            .forEach(el => {
              el.style.pointerEvents = "none";
              el.style.color = "transparent";
              el.style.caretColor = "transparent";
            });
        } catch (_) {}
      }

      // Build a dedicated click layer with invisible hitbox divs ONLY over
      // checkbox fields. This sits above tooltip layer so clicks are precise
      // and don't bleed onto non-checkbox areas.
      const clickDiv = clickLayerRef.current;
      if (clickDiv) {
        clickDiv.innerHTML = "";
        clickDiv.style.width  = `${fitWidth}px`;
        clickDiv.style.height = `${fitHeight}px`;
        clickDiv.style.margin = zoom <= 1 ? "0 auto" : "0";

        try {
          const annotations = await page.getAnnotations({ intent: "display" });
          const checkboxMap = {};

          annotations.forEach(ann => {
            if (!ann.fieldName || ann.fieldType !== "Btn") return;
            if (!INTERACTIVE_CHECKBOXES.has(ann.fieldName)) return;

            const [vx1, vy1, vx2, vy2] = cssViewport.convertToViewportRectangle(ann.rect);
            const x = Math.min(vx1, vx2);
            const y = Math.min(vy1, vy2);
            const w = Math.abs(vx2 - vx1);
            const h = Math.abs(vy2 - vy1);

            const hitbox = document.createElement("div");
            hitbox.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;cursor:pointer;z-index:1;`;
            hitbox.title = ann.fieldName;
            hitbox.addEventListener("click", () => {
              const newVal = !checksRef.current[ann.fieldName];
              console.log("[DEF-debug] clicked:", ann.fieldName, newVal);
              setCheck(ann.fieldName, newVal);
            });
            clickDiv.appendChild(hitbox);
            checkboxMap[ann.fieldName] = hitbox;
          });

          checkboxElementsRef.current = checkboxMap;
        } catch (_) {}
      }

      const tooltipDiv = tooltipLayerRef.current;
      if (tooltipDiv) {
        await renderFieldOwnerTooltips({
          page, cssViewport, container: tooltipDiv,
          fitWidth, fitHeight, getFieldOwner: getDefFieldOwner,
        });
      }
    } catch (e) { console.error("[NurseDEF] Render error:", e); }
    setRendering(false);
  }, [zoom, captureFieldRects, setCheck]);

  useEffect(() => {
    if (!pdfReady) return;
    renderPreview();
  }, [pdfReady, pdfVersion, zoom, renderPreview]);

  useEffect(() => {
    if (!pdfReady) return;
    const onResize = () => renderPreview();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pdfReady, renderPreview]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const payload = { ...form, ...checks };
      const resp = await fetch(`/api/hso/students/${studentMongoId}/def/pdf/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate PDF");
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `DEF_${studentFields["ID No"] || studentInfo?.studentId || "student"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      show({ type: "error", title: "Download failed", message: e.message });
    }
    setDownloading(false);
  };

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
      <div style={{ fontSize: 13, color: t.textMuted }}>Loading student record...</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const overlayValues = { ...studentFields, ...form, ...checks };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: t.bg }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: `1px solid ${t.divider}`, background: t.card }}>
        <button onClick={onBack} style={{ background: t.bg, border: `1px solid ${t.cardBorder}`, color: t.text, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{studentInfo?.firstName} {studentInfo?.lastName}</div>
        <div style={{ fontSize: 12, color: t.textSub }}>· {studentInfo?.studentId}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: isMobile ? "none" : "0 0 50%", minWidth: isMobile ? "none" : 380, maxWidth: isMobile ? "none" : 620, borderRight: isMobile ? "none" : `1px solid ${t.divider}`, overflowY: "auto", padding: isMobile ? "16px" : "24px 32px", boxSizing: "border-box" }}>

        <SectionCard title="Examination Details" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {ASSESSMENT_TEXT_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Oral Health Findings" t={t}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {ORAL_HEALTH_CHECKBOXES.map(opt => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[opt] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[opt] ? t.accentBg : t.card }}>
                <input type="checkbox" checked={!!checks[opt]} onChange={e => setCheck(opt, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                {opt}
              </label>
            ))}
          </div>

          {DENTURE_PAIRS.map(({ label, up, down }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 4 }}>{label}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[up] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[up] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[up]} onChange={e => setCheck(up, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  Upper
                </label>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[down] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[down] ? t.accentBg : t.card }}>
                  <input type="checkbox" checked={!!checks[down]} onChange={e => setCheck(down, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
                  Lower
                </label>
              </div>
            </div>
          ))}

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: t.text, padding: "8px 12px", border: `1.5px solid ${checks[HAWLEYS_CHECKBOX] ? t.accent : t.cardBorder}`, borderRadius: 8, background: checks[HAWLEYS_CHECKBOX] ? t.accentBg : t.card }}>
            <input type="checkbox" checked={!!checks[HAWLEYS_CHECKBOX]} onChange={e => setCheck(HAWLEYS_CHECKBOX, e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
            {HAWLEYS_CHECKBOX}
          </label>
        </SectionCard>

        <SectionCard title="Other Notes" t={t}>
          <div style={{ marginBottom: 12 }}>
            <TextInput label={OTHERS_TEXT_FIELD.label} value={form[OTHERS_TEXT_FIELD.key]} onChange={v => setField(OTHERS_TEXT_FIELD.key, v)} t={t} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {REMARKS_FIELDS.map(({ key, label }) => (
              <TextInput key={key} label={label} value={form[key]} onChange={v => setField(key, v)} t={t} />
            ))}
          </div>
        </SectionCard>

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "14px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, marginBottom: 24 }}>
          {saving ? "Saving\u2026" : "Save & Mark DEF as Filled"}
        </button>
        </div>

      <div style={{ flex: 1, height: isMobile ? "60vw" : "100%", minHeight: isMobile ? 280 : 0, background: "#374151", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#1f2937", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {rendering && <span style={{ fontSize: 11, color: "#9ca3af" }}>Updating...</span>}
            {!pdfReady && !pdfError && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading preview...</span>}
            {pdfError && <span style={{ fontSize: 11, color: "#fca5a5" }}>Preview PDF not found</span>}
            {pdfReady && !rendering && <span style={{ fontSize: 11, color: "#6ee7b7" }}>Hover a field to see who fills it · Click checkboxes to fill them →</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
              title="Zoom out" disabled={zoom <= 0.5}
              style={{ background: "none", border: "none", cursor: zoom <= 0.5 ? "not-allowed" : "pointer", color: zoom <= 0.5 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db", minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))))}
              title="Zoom in" disabled={zoom >= 3.0}
              style={{ background: "none", border: "none", cursor: zoom >= 3.0 ? "not-allowed" : "pointer", color: zoom >= 3.0 ? "#4b5563" : "#d1d5db", padding: 4, display: "flex", alignItems: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          {pdfError ? (
            <div style={{ color: "#d1d5db", fontSize: 13, padding: 20, lineHeight: 1.8 }}>
              <strong>Preview unavailable</strong><br /><br />
              Make sure <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: 4 }}>backend/public/dental-form.pdf</code> exists on the server with all DEF fields.
            </div>
          ) : (
            <div style={{ position: "relative", display: "inline-block", opacity: rendering ? 0.6 : 1, transition: "opacity 0.2s ease" }}>
              <canvas ref={canvasRef} style={{ borderRadius: 4, display: "block" }} />
              <div ref={annotationLayerRef} className="annotationLayer" style={{ position: "absolute", top: 0, left: 0, zIndex: 3 }} />
              <LiveFieldOverlay
                fieldRects={fieldRects}
                values={overlayValues}
                fitWidth={overlayDims.width}
                fitHeight={overlayDims.height}
              />
              <div ref={tooltipLayerRef} style={{ position: "absolute", top: 0, left: 0, zIndex: 6 }} />
              <div ref={clickLayerRef} style={{ position: "absolute", top: 0, left: 0, zIndex: 7 }} />
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px", background: "#1f2937" }}>
          <button onClick={handleDownloadPDF} disabled={downloading}
            style={{ width: "100%", padding: "11px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: downloading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {downloading ? "Generating..." : "Download filled DEF PDF"}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}