const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const { body, validationResult } = require("express-validator");
const User     = require("../models/User");
const { sendPasswordReset, sendBookingCode } = require("../services/email");

const JWT_SECRET = process.env.JWT_SECRET || "hso_phex_fallback_secret_2026";
const router = express.Router();

// POST /api/auth/register
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

// POST /api/auth/login
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
    // Save last login timestamp
    const prevLogin = user.lastLoginAt;
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token, user: { id: user._id, studentId: user.studentId, email: user.email, firstName: user.firstName, middleInitial: user.middleInitial, lastName: user.lastName, gender: user.gender, college: user.college, role: user.role, lastLoginAt: prevLogin || null } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => res.json({ message: "Logged out" }));

// POST /api/auth/forgot-password
router.post("/forgot-password", [
  body("email").isEmail().withMessage("Valid email required"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If an account exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000; // 1 hour
    user.resetToken   = token;
    user.resetExpires = expires;
    await user.save();

    await sendPasswordReset(email, token);
    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send reset email. Please try again." });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", [
  body("token").notEmpty(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { token, password } = req.body;
  try {
    const user = await User.findOne({ resetToken: token, resetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Reset link is invalid or has expired." });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken   = undefined;
    user.resetExpires = undefined;
    await user.save();
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Failed to reset password." });
  }
});

// POST /api/auth/forgot-booking-code
router.post("/forgot-booking-code", [
  body("email").isEmail().withMessage("Valid email required"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "If an account exists, your booking codes have been sent." });

    const Appointment = require("../models/Appointment");
    const bookings = await Appointment.find({ userId: user._id });

    if (!bookings.length) {
      return res.json({ message: "No bookings found for this account." });
    }

    for (const b of bookings) {
      await sendBookingCode(
        email,
        `${user.firstName} ${user.lastName}`,
        b.bookingCode,
        b.appointmentType,
        b.appointmentDate,
        b.timeSlot
      );
    }

    res.json({ message: "Your booking codes have been sent to your email." });
  } catch (err) {
    console.error("Forgot booking code error:", err);
    res.status(500).json({ error: "Failed to send booking codes. Please try again." });
  }
});

module.exports = router;