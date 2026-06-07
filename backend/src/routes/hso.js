const express     = require("express");
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { authMiddleware, hsoOnly } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware, hsoOnly);

// GET /api/hso/appointments?date=2026-06-08&type=phex
router.get("/appointments", async (req, res) => {
  const { date, type } = req.query;
  try {
    const filter = {};
    if (date) filter.appointmentDate = date;
    if (type) filter.appointmentType = type;

    const appointments = await Appointment.find(filter)
      .populate("userId", "firstName lastName email studentId college")
      .sort({ appointmentDate: 1, timeSlot: 1 });

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// PATCH /api/hso/appointments/:id/attend
router.patch("/appointments/:id/attend", async (req, res) => {
  try {
    await Appointment.findByIdAndUpdate(req.params.id, { status: "attended", attendedAt: new Date() });
    res.json({ message: "Marked as attended" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});

// PATCH /api/hso/appointments/:id/clear
router.patch("/appointments/:id/clear", async (req, res) => {
  try {
    await Appointment.findByIdAndUpdate(req.params.id, { status: "cleared", hsoNotes: req.body.notes || null, clearedAt: new Date() });
    res.json({ message: "Student cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear" });
  }
});

// GET /api/hso/compliance
router.get("/compliance", async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).select("-passwordHash");
    const appointments = await Appointment.find({});

    const report = students.map(s => {
      const phex = appointments.find(a => String(a.userId) === String(s._id) && a.appointmentType === "phex");
      const dt   = appointments.find(a => String(a.userId) === String(s._id) && a.appointmentType === "dt");
      return {
        studentId:  s.studentId,
        name:       `${s.firstName} ${s.lastName}`,
        email:      s.email,
        college:    s.college,
        phexStatus: phex?.status || "not booked",
        dtStatus:   dt?.status  || "not booked",
      };
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch compliance" });
  }
});

// GET /api/hso/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalStudents, phexBooked, dtBooked, cleared] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Appointment.distinct("userId", { appointmentType: "phex" }).then(r => r.length),
      Appointment.distinct("userId", { appointmentType: "dt"   }).then(r => r.length),
      Appointment.distinct("userId", { status: "cleared" }).then(r => r.length),
    ]);
    res.json({ totalStudents, phexBooked, dtBooked, cleared });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;