const express = require("express");
const User    = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/students/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const Appointment = require("../models/Appointment");
    const now = new Date();

    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });

    const appointments = await Appointment.find({ userId: user._id, status: "confirmed" });
    const phex = appointments.find(a => a.appointmentType === "phex");
    const dt   = appointments.find(a => a.appointmentType === "dt");

    const isPast = (appt) => appt && new Date(appt.appointmentDate + "T23:59:59") < now;

    // Reset progress only if appointments are missing (dropped/auto-cancelled)
    // Do NOT reset when appointments are past — that means student attended
    const needsReset = !phex || !dt;
    if (needsReset && (user.filledMEF || user.filledDEF || user.checklist?.length > 0)) {
      user.filledMEF  = false;
      user.filledDEF  = false;
      user.checklist  = [];
      // Only reset attendance if student hasn't attended yet
      if (!user.attendedFirst)  user.attendedFirst  = false;
      if (!user.attendedSecond) user.attendedSecond = false;
    }

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
      // Determine which appointment comes first
      const phexMs = new Date(phex.appointmentDate + "T00:00:00").getTime() + parseMin(phex.timeSlot) * 60000;
      const dtMs   = new Date(dt.appointmentDate   + "T00:00:00").getTime() + parseMin(dt.timeSlot)   * 60000;
      const phexFirst = phexMs <= dtMs;

      const firstAppt       = phexFirst ? phex : dt;
      const secondAppt      = phexFirst ? dt   : phex;
      const firstChecklist  = phexFirst ? CHECKLIST_PHEX : CHECKLIST_DT;
      const secondChecklist = phexFirst ? CHECKLIST_DT   : CHECKLIST_PHEX;

      const firstCheckedDone  = firstChecklist.every(id  => user.checklist.includes(id));
      const secondCheckedDone = secondChecklist.every(id => user.checklist.includes(id));
      const firstPast  = isPast(firstAppt);
      const secondPast = isPast(secondAppt);

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

    // Save calculated step + any resets to DB
    await User.findByIdAndUpdate(user._id, {
      filledMEF:      user.filledMEF,
      filledDEF:      user.filledDEF,
      checklist:      user.checklist,
      attendedFirst:  user.attendedFirst,
      attendedSecond: user.attendedSecond,
      currentStep:    calculatedStep,
    });

    user.currentStep = calculatedStep;
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

// PUT /api/students/me/progress — save checklist + step + form progress
router.put("/me/progress", authMiddleware, async (req, res) => {
  const { checklist, filledMEF, filledDEF, currentStep } = req.body;
  try {
    const update = {};
    if (checklist   !== undefined) update.checklist   = checklist;
    if (filledMEF   !== undefined) update.filledMEF   = filledMEF;
    if (filledDEF   !== undefined) update.filledDEF   = filledDEF;
    if (currentStep !== undefined) update.currentStep = currentStep;
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