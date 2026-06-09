/**
 * Auto-cancel appointments that are outside the student's booking window.
 * Runs every minute via cron.
 *
 * Rule: if the student's booking window is NOT currently open AND the
 * appointment has not yet been attended → DELETE the appointment and restore the slot.
 *
 * A bypassed booking (booked outside the window) is dropped immediately.
 * A past appointment (student attended) is always kept.
 */

const cron        = require("node-cron");
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { getModel } = require("../models/Slot");

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
  return BOOKING_PERIODS.find(p => prefix === p.prefix)
    || (parseInt(prefix) <= 121 ? BOOKING_PERIODS[4] : null);
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

  try {
    // Get ALL confirmed appointments
    const appointments = await Appointment.find({ status: "confirmed" });
    let cancelled = 0;

    for (const appt of appointments) {
      // Get the student's booking window
      const user = await User.findById(appt.userId).select("studentId").lean();
      if (!user) continue;

      const period = getBookingPeriod(user.studentId);
      if (!period) continue;

      // Is the booking window currently open for this student?
      const bookingIsOpen = now >= period.bookStart && now <= period.bookEnd;

      // Has the appointment date already passed? (student attended)
      const apptDate  = new Date(appt.appointmentDate + "T23:59:59");
      const apptPassed = apptDate < now;

      // Drop if booking window is not currently open — no exceptions
      if (!bookingIsOpen) {
        await releaseSlot(appt);
        await Appointment.deleteOne({ _id: appt._id });
        cancelled++;
        console.log(
          `[AutoCancel] Dropped ${appt.appointmentType} for student ${user.studentId}` +
          ` on ${appt.appointmentDate} — booking window not open`
        );
      }
    }

    if (cancelled > 0) {
      console.log(`[AutoCancel] Cancelled ${cancelled} appointment(s)`);
    }
  } catch (err) {
    console.error("[AutoCancel] Error:", err.message);
  }
}

function startAutoCancel() {
  // Run every 1 minute
  cron.schedule("* * * * *", () => {
    runAutoCancel();
  });

  // Run once on startup after 5 seconds
  setTimeout(runAutoCancel, 5000);
  console.log("[AutoCancel] Scheduler started — runs every minute");
}

module.exports = { startAutoCancel, runAutoCancel };