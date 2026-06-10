/**
 * Seed HSO staff accounts: one nurse, one admin, one master
 * Run: node src/services/seedStaff.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const User     = require("../models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hso_phex";

const STAFF = [
  {
    email:     "nurse@dlsu.edu.ph",
    firstName: "HSO",
    lastName:  "Nurse",
    role:      "nurse",
    password:  "nurse1234",
  },
  {
    email:     "admin@dlsu.edu.ph",
    firstName: "HSO",
    lastName:  "Admin",
    role:      "admin",
    password:  "admin1234",
  },
  {
    email:     "master@dlsu.edu.ph",
    firstName: "HSO",
    lastName:  "Master",
    role:      "master",
    password:  "master1234",
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const staff of STAFF) {
      const existing = await User.findOne({ email: staff.email });
      if (existing) {
        console.log("Already exists: " + staff.email + " (" + staff.role + ") -- skipping");
        continue;
      }
      const passwordHash = await bcrypt.hash(staff.password, 12);
      await User.create({
        studentId:     staff.email,
        email:         staff.email,
        passwordHash,
        firstName:     staff.firstName,
        lastName:      staff.lastName,
        role:          staff.role,
        middleInitial: "",
      });
      console.log("Created " + staff.role + ": " + staff.email + " / password: " + staff.password);
    }

    console.log("\nDone. Change passwords after first login!");
  } catch (err) {
    console.error("Seed error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
