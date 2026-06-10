const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentId:       { type: String },
  appointmentType: { type: String, enum: ["phex", "dt"], required: true },
  appointmentDate: { type: String, required: true },
  timeSlot:        { type: String, required: true },
  bookingCode:     { type: String },
  status:          { type: String, enum: ["confirmed", "attended", "cleared", "cancelled"], default: "confirmed" },
  hsoNotes:        { type: String },
  reminderSent:    { type: Boolean, default: false },
  attendedAt:      { type: Date },
  clearedAt:       { type: Date },
}, { timestamps: true });

// One booking per student per activity type
appointmentSchema.index({ userId: 1, appointmentType: 1 }, { unique: true });
// For slot availability queries
appointmentSchema.index({ appointmentDate: 1, timeSlot: 1, appointmentType: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);