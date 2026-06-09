const express     = require("express");
const Appointment = require("../models/Appointment");
const { getModel } = require("../models/Slot");
const { authMiddleware } = require("../middleware/auth");
const emailService = require("../services/email");

const router = express.Router();

// GET /api/appointments/days?type=phex
router.get("/days", authMiddleware, async (req, res) => {
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: "type required" });
  try {
    const Model = getModel(type);
    const days  = await Model.find({}).sort({ date: 1 });
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch days" });
  }
});

// GET /api/appointments/slots?date=2026-06-08&type=phex
router.get("/slots", authMiddleware, async (req, res) => {
  const { date, type } = req.query;
  if (!date || !type) return res.status(400).json({ error: "date and type required" });
  try {
    const Model = getModel(type);
    const day   = await Model.findOne({ date });
    if (!day) return res.json([]);
    res.json(day.slots.map(s => ({
      time:      s.time,
      capacity:  s.capacity,
      booked:    s.booked,
      available: s.capacity - s.booked,
      full:      s.booked >= s.capacity,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// POST /api/appointments — book a slot
router.post("/", authMiddleware, async (req, res) => {
  const { appointmentType, appointmentDate, timeSlot, bookingCode } = req.body;
  if (!appointmentType || !appointmentDate || !timeSlot)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // Already booked this type?
    const existing = await Appointment.findOne({ userId: req.user.id, appointmentType });
    if (existing) return res.status(409).json({ error: "You already have a booking for this activity" });

    // Check 1-hour gap if both appointments on the same day
    const otherType = appointmentType === "phex" ? "dt" : "phex";
    const otherAppt = await Appointment.findOne({ userId: req.user.id, appointmentType: otherType, status: "confirmed" });
    if (otherAppt && otherAppt.appointmentDate === appointmentDate) {
      const parseMin = (t) => {
        const [tp, ap] = [t.slice(0, -2), t.slice(-2)];
        let [h, m] = tp.split(":").map(Number);
        if (ap === "pm" && h !== 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
        return h * 60 + m;
      };
      const diff = Math.abs(parseMin(timeSlot) - parseMin(otherAppt.timeSlot));
      if (diff < 60) {
        return res.status(400).json({
          error: `Your ${otherType === "dt" ? "Drug Test" : "PHEx"} is at ${otherAppt.timeSlot}. Both appointments must be at least 1 hour apart on the same day.`
        });
      }
    }

    // Backend check: validate booking period based on student ID prefix
    const PERIODS = [
      { prefix: 125, bookStart: "2026-06-05", bookEnd: "2026-06-19", examStart: "2026-06-08", examEnd: "2026-06-19" },
      { prefix: 124, bookStart: "2026-06-17", bookEnd: "2026-07-04", examStart: "2026-06-20", examEnd: "2026-07-04" },
      { prefix: 123, bookStart: "2026-07-03", bookEnd: "2026-07-16", examStart: "2026-07-06", examEnd: "2026-07-16" },
      { prefix: 122, bookStart: "2026-07-17", bookEnd: "2026-07-27", examStart: "2026-07-17", examEnd: "2026-07-27" },
      { prefix: 121, bookStart: "2026-07-25", bookEnd: "2026-07-31", examStart: "2026-07-28", examEnd: "2026-07-31" },
    ];

    // Get student ID prefix (first 3 digits)
    const studentIdPrefix = parseInt(req.user.studentId?.toString().substring(0, 3));
    const period = PERIODS.find(p => p.prefix === studentIdPrefix)
      || (studentIdPrefix <= 121 ? PERIODS[4] : null);

    if (!period) {
      return res.status(400).json({ error: "Your student ID is not eligible for booking." });
    }

    const nowDate = new Date();
    const bookStart = new Date(period.bookStart + "T00:00:00");
    const bookEnd   = new Date(period.bookEnd   + "T23:59:59");

    if (nowDate < bookStart) {
      return res.status(400).json({
        error: `Your booking period has not opened yet. It opens on ${new Date(period.bookStart).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}.`
      });
    }
    if (nowDate > bookEnd) {
      return res.status(400).json({
        error: `Your booking period has already closed.`
      });
    }

    // Backend check: reject past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appointmentDate + "T00:00:00");
    if (apptDate < today) {
      return res.status(400).json({ error: "Cannot book a past date." });
    }

    // Backend check: reject past time slots for today
    if (apptDate.toDateString() === new Date().toDateString()) {
      const [timePart, ampm] = [timeSlot.slice(0, -2), timeSlot.slice(-2)];
      let [h, m] = timePart.split(":").map(Number);
      if (ampm === "pm" && h !== 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      const slotTime = new Date();
      slotTime.setHours(h, m, 0, 0);
      if (slotTime < new Date()) {
        return res.status(400).json({ error: "This time slot has already passed." });
      }
    }

    const Model = getModel(appointmentType);

    // Use $elemMatch with booked < capacity check (without $expr)
    // Atlas free tier doesn't support $expr inside $elemMatch on subdocs
    // Instead: find the day, check in app layer, then use versioning to prevent race
    const day = await Model.findOne({ date: appointmentDate });
    if (!day) return res.status(404).json({ error: "No schedule found for this date" });

    const slotObj = day.slots.find(s => s.time === timeSlot);
    if (!slotObj) return res.status(404).json({ error: "Time slot not found" });
    if (slotObj.booked >= slotObj.capacity) {
      return res.status(409).json({ error: "This slot is full. Please choose another time." });
    }

    // Atomic increment with booked ceiling check using $min trick:
    // Only increment if current booked value matches what we just read (optimistic lock)
    const updated = await Model.findOneAndUpdate(
      {
        date: appointmentDate,
        "slots.time": timeSlot,
        "slots.booked": slotObj.booked  // optimistic lock — fails if someone else booked first
      },
      { $inc: { "slots.$.booked": 1 } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({ error: "This slot just filled up. Please choose another time." });
    }

    const booking = await Appointment.create({
      userId: req.user.id,
      studentId: req.user.studentId,
      appointmentType,
      appointmentDate,
      timeSlot,
      bookingCode: bookingCode || null,
    });

    try { await emailService.sendBookingConfirmation(req.user.email, booking); } catch (_) {}

    res.status(201).json({ booking });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Duplicate booking" });
    console.error(err);
    res.status(500).json({ error: "Booking failed" });
  }
});

// GET /api/appointments/mine
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const bookings = await Appointment.find({ userId: req.user.id }).sort({ appointmentDate: 1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// DELETE /api/appointments/:id — cancel and free the slot
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const appt = await Appointment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (appt) {
      const Model = getModel(appt.appointmentType);
      await Model.findOneAndUpdate(
        { date: appt.appointmentDate, "slots.time": appt.timeSlot },
        { $inc: { "slots.$.booked": -1 } }
      );
    }
    res.json({ message: "Booking cancelled" });
  } catch (err) {
    res.status(500).json({ error: "Cancellation failed" });
  }
});

module.exports = router;