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
const { sendAppointmentReminder } = require("./email");

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

const parseMin = (t) => {
  const [tp, ap] = [t.slice(0, -2), t.slice(-2)];
  let [h, m] = tp.split(":").map(Number);
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + m;
};

async function runAutoCancel() {
  const now = new Date();
  try {
    const appointments = await Appointment.find({ status: "confirmed" });
    let cancelled = 0;

    // ── Check same-day 1-hour gap violations ─────────────────────────────
    // Group by userId
    const byUser = {};
    for (const appt of appointments) {
      const uid = appt.userId.toString();
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(appt);
    }
    for (const [userId, appts] of Object.entries(byUser)) {
      const phex = appts.find(a => a.appointmentType === "phex");
      const dt   = appts.find(a => a.appointmentType === "dt");
      if (phex && dt && phex.appointmentDate === dt.appointmentDate) {
        const diff = Math.abs(parseMin(phex.timeSlot) - parseMin(dt.timeSlot));
        if (diff < 60) {
          // Drop both + restore slots + reset progress
          for (const appt of [phex, dt]) {
            await releaseSlot(appt);
            await Appointment.deleteOne({ _id: appt._id });
          }
          await User.findByIdAndUpdate(userId, { filledMEF: false, filledDEF: false, checklist: [], attendedFirst: false, attendedSecond: false });
          cancelled += 2;
          console.log(`[AutoCancel] Dropped both appointments for user ${userId} — same-day gap < 1 hour`);
        }
      }
    }

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
          filledMEF:      false,
          filledDEF:      false,
          checklist:      [],
          attendedFirst:  false,
          attendedSecond: false,
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

    // ── 24-hour reminder emails ───────────────────────────────────────────
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const tomorrowAppts = await Appointment.find({ status: "confirmed", appointmentDate: tomorrowStr });
    for (const appt of tomorrowAppts) {
      if (appt.reminderSent) continue;
      try {
        const user = await User.findById(appt.userId).select("email firstName lastName").lean();
        if (!user) continue;
        const venue = appt.appointmentType === "phex"
          ? "Waldo Perfecto Seminar Room, Ground floor, Br. Connon Hall"
          : "2nd Floor, Enrique Razon Sports Center (ERSC)";
        await sendAppointmentReminder(
          user.email,
          `${user.firstName} ${user.lastName}`,
          appt.appointmentType,
          appt.appointmentDate,
          appt.timeSlot,
          venue
        );
        await Appointment.findByIdAndUpdate(appt._id, { reminderSent: true });
        console.log(`[Reminder] Sent to ${user.email} for ${appt.appointmentType} on ${appt.appointmentDate}`);
      } catch (err) {
        console.error(`[Reminder] Failed for appt ${appt._id}:`, err.message);
      }
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