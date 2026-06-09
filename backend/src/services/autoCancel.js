/**
 * Auto-cancel appointments that are outside the student's booking period.
 *
 * Rules:
 * - If the appointment date has ALREADY PASSED → keep it (student attended)
 * - If booking period is NOT YET open → drop the appointment + restore the slot
 * - If booking period HAS CLOSED and appointment date is in the future → drop it
 *
 * ID prefix → booking window mapping (matches frontend schedule.js)
 */

const cron        = require("node-cron");
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { getModel } = require("../models/Slot");

// Same schedule as frontend utils/schedule.js
const BOOKING_PERIODS = [
  { prefix: "125", bookStart: new Date("2026-06-05"), bookEnd: new Date("2026-06-19") },
  { prefix: "124", bookStart: new Date("2026-06-17"), bookEnd: new Date("2026-07-04") },
  { prefix: "123", bookStart: new Date("2026-07-03"), bookEnd: new Date("2026-07-16") },
  { prefix: "122", bookStart: new Date("2026-07-17"), bookEnd: new Date("2026-07-27") },
  { prefix: "121", bookStart: new Date("2026-07-25"), bookEnd: new Date("2026-07-31") },
];

function getBookingPeriod(studentId) {
  if (!studentId) return null;
  const prefix = String(studentId).substring(0, 3);
  const period = BOOKING_PERIODS.find(p => prefix === p.prefix)
    || (parseInt(prefix) <= 121 ? BOOKING_PERIODS[4] : null);
  return period || null;
}

async function releaseSlot(appointment) {
  try {
    const Model = getModel(appointment.appointmentType);
    await Model.findOneAndUpdate(
      { date: appointment.appointmentDate, "slots.time": appointment.timeSlot },
      { $inc: { "slots.$.booked": -1 } }
    );
  } catch (err) {
    console.error("Failed to release slot:", err.message);
  }
}

async function runAutoCancel() {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  try {
    // Get all confirmed appointments whose date is TODAY or FUTURE
    // (past appointments are kept — student attended)
    const appointments = await Appointment.find({
      status: "confirmed",
      appointmentDate: { $gte: todayStr },
    });

    let cancelled = 0;

    for (const appt of appointments) {
      // Get the student's ID prefix
      const user = await User.findById(appt.userId).select("studentId").lean();
      if (!user) continue;

      const period = getBookingPeriod(user.studentId);
      if (!period) continue;

      // If booking period hasn't opened yet OR has already closed → cancel
      const bookingIsOpen = now >= period.bookStart && now <= period.bookEnd;
      const bookingHasClosed = now > period.bookEnd;
      const bookingNotYetOpen = now < period.bookStart;

      if (bookingHasClosed || bookingNotYetOpen) {
        // Release the slot back
        await releaseSlot(appt);
        // Delete the appointment
        await Appointment.deleteOne({ _id: appt._id });
        cancelled++;
        console.log(`[AutoCancel] Dropped ${appt.appointmentType} for ${user.studentId} on ${appt.appointmentDate} — booking period ${bookingNotYetOpen ? "not open" : "closed"}`);
      }
    }

    if (cancelled > 0) {
      console.log(`[AutoCancel] Cancelled ${cancelled} out-of-period appointment(s)`);
    }
  } catch (err) {
    console.error("[AutoCancel] Error:", err.message);
  }
}

function startAutoCancel() {
  // Run every 1 minute
  cron.schedule("* * * * *", () => {
    console.log("[AutoCancel] Running scheduled check...");
    runAutoCancel();
  });

  // Also run once on startup
  setTimeout(runAutoCancel, 5000);
  console.log("[AutoCancel] Scheduler started");
}

module.exports = { startAutoCancel, runAutoCancel };