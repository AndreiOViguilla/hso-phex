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

// PUT /api/students/me/checklist — save checklist state
router.put("/me/checklist", authMiddleware, async (req, res) => {
  const { checklist } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { checklist },
      { new: true }
    ).select("-passwordHash");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update checklist" });
  }
});

module.exports = router;