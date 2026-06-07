const express = require("express");
const User    = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

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

router.put("/me", authMiddleware, async (req, res) => {
  const { firstName, lastName, college, contact } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, college, contact },
      { new: true }
    ).select("-passwordHash");
    res.json(user);
  } catch (err) {
    console.error("PUT /me error:", err.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;