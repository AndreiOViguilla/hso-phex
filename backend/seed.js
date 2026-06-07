require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hso_phex";

function generateTimes() {
  const times = [];
  const add = (h, m) => {
    const hour = h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? "pm" : "am";
    const min  = m === 0 ? "00" : String(m).padStart(2, "0");
    times.push(`${hour}:${min}${ampm}`);
  };
  for (let h = 8;  h < 12; h++) for (let m = 0; m < 60; m += 15) add(h, m);
  for (let h = 13; h < 18; h++) for (let m = 0; m < 60; m += 15) add(h, m);
  return times;
}

function getDates(startStr, endStr) {
  const dates = [];
  const cur = new Date(startStr + "T00:00:00");
  const end = new Date(endStr   + "T00:00:00");
  while (cur <= end) {
    if (cur.getDay() !== 0)
      dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const PERIODS = [
  { start: "2026-06-05", end: "2026-06-19" },
  { start: "2026-06-17", end: "2026-07-04" },
  { start: "2026-07-03", end: "2026-07-16" },
  { start: "2026-07-17", end: "2026-07-27" },
  { start: "2026-07-25", end: "2026-07-31" },
];

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected");

  const db = mongoose.connection.db;
  const times = generateTimes();

  const allDates = [...new Set(
    PERIODS.flatMap(p => getDates(p.start, p.end))
  )].sort();

  // PHEx schedules
  const c1 = await db.listCollections({ name: "phexschedules" }).toArray();
  if (c1.length > 0) { await db.dropCollection("phexschedules"); console.log("✓ Dropped phexschedules"); }

  const phexDocs = allDates.map(date => ({
    date,
    type: "phex",
    venue: "Waldo Perfecto Seminar Room, Ground floor, Br. Connon Hall",
    slots: times.map(time => ({ time, capacity: 15, booked: 0 })),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await db.collection("phexschedules").insertMany(phexDocs);
  console.log(`✓ PHEx: ${phexDocs.length} days seeded`);

  // Drug Test schedules
  const c2 = await db.listCollections({ name: "dtschedules" }).toArray();
  if (c2.length > 0) { await db.dropCollection("dtschedules"); console.log("✓ Dropped dtschedules"); }

  const dtDocs = allDates.map(date => ({
    date,
    type: "dt",
    venue: "2nd floor, Enrique Razon Sports Center (ERSC)",
    slots: times.map(time => ({ time, capacity: 15, booked: 0 })),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await db.collection("dtschedules").insertMany(dtDocs);
  console.log(`✓ Drug Test: ${dtDocs.length} days seeded`);

  console.log(`\n✓ Total: ${phexDocs.length + dtDocs.length} documents`);
  console.log("✓ Check Atlas: phexschedules and dtschedules collections");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});