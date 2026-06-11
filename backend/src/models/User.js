const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

// Field-level encryption for sensitive data
const FIELD_KEY = process.env.FIELD_ENCRYPTION_KEY || "hso_phex_field_enc_key_32bytes!!";
const KEY = Buffer.from(FIELD_KEY.padEnd(32).slice(0, 32));
const ALGO = "aes-256-cbc";

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!text || !text.includes(":")) return text;
  try {
    const [ivHex, encHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch { return text; }
}

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
  role:         { type: String, enum: ["student", "admin", "master", "nurse"], default: "student" },
  lastLoginAt:  { type: Date },
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
  currentStep:  { type: Number, default: 1, min: 1, max: 7 },
  attendedFirst:  { type: Boolean, default: false },
  attendedSecond: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);