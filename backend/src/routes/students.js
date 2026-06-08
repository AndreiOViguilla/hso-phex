const express = require("express");
const User    = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/students/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
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

module.exports = router;