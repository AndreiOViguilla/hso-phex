const express    = require("express");
const router     = express.Router();
const User       = require("../models/User");
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
      await existing.save();
      return res.json(existing);
    }
    const newSlot = await SlotModel.create({ date, slots });
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
router.get("/students", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const students = await User.find({ role: "student" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hso/students/:id/appointments
router.get("/students/:id/appointments", authMiddleware, requireRole("admin", "master"), async (req, res) => {
  try {
    const appts = await Appointment.find({ userId: req.params.id }).sort({ appointmentDate: 1 });
    res.json(appts);
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
    res.json(users);
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