const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema({
  time:     { type: String, required: true },
  capacity: { type: Number, default: 15 },
  booked:   { type: Number, default: 0 },
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
  date:  { type: String, required: true, unique: true },
  type:  { type: String, enum: ["phex", "dt"], required: true },
  venue: { type: String },
  slots: [timeSlotSchema],
}, { timestamps: true });

// Two separate models pointing to two separate collections
const PHExSchedule = mongoose.model("PHExSchedule", scheduleSchema, "phexschedules");
const DTSchedule   = mongoose.model("DTSchedule",   scheduleSchema, "dtschedules");

function getModel(type) {
  return type === "phex" ? PHExSchedule : DTSchedule;
}

module.exports = { PHExSchedule, DTSchedule, getModel };