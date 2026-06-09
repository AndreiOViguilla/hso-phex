/**
 * Auto-cancel appointments that are outside the student's booking window.
 * Runs every minute via cron.
 *
 * Rule: if the student's booking window is NOT currently open → DELETE the
 * appointment, restore the slot, and reset the student's form/checklist progress.
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
    const appointments = await Appointment.find({ status: "confirmed" });
    let cancelled = 0;

    for (const appt of appointments) {
      const user = await User.findById(appt.userId).select("studentId").lean();
      if (!user) continue;

      const period = getBookingPeriod(user.studentId);
      if (!period) continue;

      const bookingIsOpen = now >= period.bookStart && now <= period.bookEnd;

      if (!bookingIsOpen) {
        // 1. Restore the slot
        await releaseSlot(appt);

        // 2. Delete the appointment
        await Appointment.deleteOne({ _id: appt._id });

        // 3. Reset student's form/checklist progress in DB
        await User.findByIdAndUpdate(appt.userId, {
          filledMEF: false,
          filledDEF: false,
          checklist: [],
        });

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
  cron.schedule("* * * * *", () => {
    runAutoCancel();
  });
  setTimeout(runAutoCancel, 5000);
  console.log("[AutoCancel] Scheduler started — runs every minute");
}

module.exports = { startAutoCancel, runAutoCancel };