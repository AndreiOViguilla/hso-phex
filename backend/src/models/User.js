const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  studentId:    { type: String, unique: true, sparse: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  firstName:    { type: String, required: true },
  middleInitial:{ type: String, default: "" },
  gender:       { type: String, enum: ["Female", "Male", ""], default: "" },
  lastName:     { type: String, required: true },
  college:      { type: String },
  contact:      { type: String },
  role:         { type: String, enum: ["student", "hso"], default: "student" },
}, { timestamps: true });

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);