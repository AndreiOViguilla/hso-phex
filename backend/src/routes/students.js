const express = require("express");
const User    = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Helper: build a Google Calendar URL from an appointment
function buildGCalUrl(label, venue, dateStr, timeSlot) {
  const [tp, ap] = [timeSlot.slice(0, -2), timeSlot.slice(-2)];
  let [h, m] = tp.split(":").map(Number);
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const pad = (n) => String(n).padStart(2, "0");
  const startDt = `${dateStr.replace(/-/g, "")}T${pad(h)}${pad(m)}00`;
  const endDt   = `${dateStr.replace(/-/g, "")}T${pad(h + 1)}${pad(m)}00`;
  const title    = encodeURIComponent(`${label} Appointment — DLSU HSO`);
  const details  = encodeURIComponent(`Your ${label} appointment at ${venue}. Show your confirmation email to the guard.`);
  const location = encodeURIComponent(venue);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&details=${details}&location=${location}&ctz=Asia/Manila`;
}

const VENUE_MAP = {
  phex: "Waldo Perfecto Seminar Room",
  dt:   "2nd Floor, Enrique Razon Sports Center (ERSC)",
};
const LABEL_MAP = {
  phex: "PHEx",
  dt:   "Drug Test",
};

// GET /api/students/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const Appointment = require("../models/Appointment");
    const now = new Date();

    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });

    const appointments = await Appointment.find({ userId: user._id, status: { $in: ["confirmed", "attended"] } });
    const phex = appointments.find(a => a.appointmentType === "phex");
    const dt   = appointments.find(a => a.appointmentType === "dt");

    const isPast = (appt) => appt && new Date(appt.appointmentDate + "T23:59:59") < now;

    // NOTE: No resets here — resets only happen via autoCancel service

    // ── Calculate currentStep server-side ────────────────────────────────
    const parseMin = (t) => {
      const [tp, ap] = [t.slice(0, -2), t.slice(-2)];
      let [h, m] = tp.split(":").map(Number);
      if (ap === "pm" && h !== 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      return h * 60 + m;
    };

    const CHECKLIST_PHEX = ["mef", "id", "fast", "clothes", "glasses", "arrive"];
    const CHECKLIST_DT   = ["def", "id_dt", "water", "avoid", "arrive_dt"];

    let calculatedStep = 1;

    if (phex && dt) {
      const phexMs = new Date(phex.appointmentDate + "T00:00:00").getTime() + parseMin(phex.timeSlot) * 60000;
      const dtMs   = new Date(dt.appointmentDate   + "T00:00:00").getTime() + parseMin(dt.timeSlot)   * 60000;
      const phexFirst = phexMs <= dtMs;

      const firstAppt       = phexFirst ? phex : dt;
      const secondAppt      = phexFirst ? dt   : phex;
      const firstChecklist  = phexFirst ? CHECKLIST_PHEX : CHECKLIST_DT;
      const secondChecklist = phexFirst ? CHECKLIST_DT   : CHECKLIST_PHEX;

      const firstCheckedDone  = firstChecklist.every(id => user.checklist.includes(id));
      const secondCheckedDone = secondChecklist.every(id => user.checklist.includes(id));

      if (!user.filledMEF || !user.filledDEF) {
        calculatedStep = 2;
      } else if (!firstCheckedDone) {
        calculatedStep = 3;
      } else if (!user.attendedFirst) {
        calculatedStep = 4;
      } else if (!secondCheckedDone) {
        calculatedStep = 5;
      } else if (!user.attendedSecond) {
        calculatedStep = 6;
      } else {
        calculatedStep = 7;
      }
    }

    // Save calculated step to DB
    await User.findByIdAndUpdate(user._id, {
      filledMEF:      user.filledMEF,
      filledDEF:      user.filledDEF,
      checklist:      user.checklist,
      attendedFirst:  user.attendedFirst,
      attendedSecond: user.attendedSecond,
      currentStep:    calculatedStep,
    });

    user.currentStep = calculatedStep;

    // ── Attach Google Calendar URLs ───────────────────────────────────────
    if (phex && !isPast(phex)) {
      user._doc.phexGCalUrl = buildGCalUrl(
        LABEL_MAP.phex,
        VENUE_MAP.phex,
        phex.appointmentDate,
        phex.timeSlot
      );
    }
    if (dt && !isPast(dt)) {
      user._doc.dtGCalUrl = buildGCalUrl(
        LABEL_MAP.dt,
        VENUE_MAP.dt,
        dt.appointmentDate,
        dt.timeSlot
      );
    }

    res.json(user);
  } catch (err) {
    console.error("GET /me error:", err.message);
    res.status(500).json({ error: "Failed to fetch profile", detail: err.message });
  }
});

// PUT /api/students/me — update editable fields only (studentId is NOT editable)
router.put("/me", authMiddleware, async (req, res) => {
  const { firstName, middleInitial, lastName, gender, college, birthday, contact, course } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, middleInitial, lastName, gender, college, birthday, contact, course },
      { new: true }
    ).select("-passwordHash");
    res.json(user);
  } catch (err) {
    console.error("PUT /me error:", err.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT /api/students/me/progress — save checklist + step + form progress + attendance
router.put("/me/progress", authMiddleware, async (req, res) => {
  const { checklist, filledMEF, filledDEF, currentStep, attendedFirst, attendedSecond } = req.body;
  try {
    const update = {};
    if (checklist       !== undefined) update.checklist       = checklist;
    if (filledMEF       !== undefined) update.filledMEF       = filledMEF;
    if (filledDEF       !== undefined) update.filledDEF       = filledDEF;
    if (currentStep     !== undefined) update.currentStep     = currentStep;
    if (attendedFirst   !== undefined) update.attendedFirst   = attendedFirst;
    if (attendedSecond  !== undefined) update.attendedSecond  = attendedSecond;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select("-passwordHash");
    res.json(user);
  } catch (err) {
    console.error("PUT /me/progress error:", err.message);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// PUT /api/students/me/password
router.put("/me/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both current and new password are required." });
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  try {
    const user = await User.findById(req.user.id);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) return res.status(401).json({ error: "Current password is incorrect." });
    const bcrypt = require("bcryptjs");
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: "Failed to change password." });
  }
});

module.exports = router;