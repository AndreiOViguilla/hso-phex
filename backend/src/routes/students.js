const express = require("express");
const db      = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/students/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, student_id, email, first_name, last_name, college, role FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/students/me
router.put("/me", authMiddleware, async (req, res) => {
  const { firstName, lastName, college, contact } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET first_name = $1, last_name = $2, college = $3, contact = $4
       WHERE id = $5
       RETURNING id, student_id, email, first_name, last_name, college`,
      [firstName, lastName, college, contact, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
