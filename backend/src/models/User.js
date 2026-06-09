const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  studentId:    { type: String, unique: true, sparse: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  firstName:    { type: String, required: true },
  middleInitial:{ type: String, default: "" },
  lastName:     { type: String, required: true },
  gender:       { type: String, enum: ["Female", "Male", ""], default: "" },
  college:      { type: String, default: "" },
  birthday:     { type: String, default: "" }, // stored as "YYYY-MM-DD"
  contact:      { type: String, default: "" },
  course:       { type: String, default: "" },
  role:         { type: String, enum: ["student", "hso"], default: "student" },
  resetToken:   { type: String },
  resetExpires: { type: Number },
  // Results from HSO
  phexResult:   { type: String, default: "" }, // "pending" | "released" | "claimed"
  dtResult:     { type: String, default: "" },
  // Checklist — which items student has checked off
  checklist:    { type: [String], default: [] },
  // Progress tracking
  filledMEF:    { type: Boolean, default: false },
  filledDEF:    { type: Boolean, default: false },
  currentStep:  { type: Number, default: 1, min: 1, max: 6 },
  attendedFirst:  { type: Boolean, default: false },
  attendedSecond: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);