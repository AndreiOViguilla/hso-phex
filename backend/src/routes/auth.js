const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User     = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "hso_phex_fallback_secret_2026";
const router = express.Router();

router.post("/register", [
  body("studentId").isLength({ min: 7 }).withMessage("Invalid student ID"),
  body("email").isEmail().withMessage("Invalid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("firstName").notEmpty().withMessage("First name required"),
  body("lastName").notEmpty().withMessage("Last name required"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { studentId, email, password, firstName, middleInitial, lastName, gender, college } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ studentId, email, passwordHash, firstName, middleInitial: middleInitial || "", lastName, gender: gender || "", college: college || "" });
    const token = jwt.sign({ id: user._id, studentId: user.studentId, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, studentId: user.studentId, email: user.email, firstName: user.firstName, middleInitial: user.middleInitial, lastName: user.lastName, gender: user.gender, college: user.college, role: user.role } });
  } catch (err) {
    if (err.code === 11000) { const field = Object.keys(err.keyPattern)[0]; return res.status(409).json({ error: field === "email" ? "Email already registered" : "Student ID already registered" }); }
    console.error(err); res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", [
  body("email").isEmail(),
  body("password").notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "No account found with this email" });
    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ error: "Incorrect password" });
    const token = jwt.sign({ id: user._id, studentId: user.studentId, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, studentId: user.studentId, email: user.email, firstName: user.firstName, middleInitial: user.middleInitial, lastName: user.lastName, gender: user.gender, college: user.college, role: user.role } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => res.json({ message: "Logged out" }));

module.exports = router;