-- HSO PHEx Database Schema
-- Run this in your PostgreSQL database to set up the tables

-- Users table (students + HSO staff)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  student_id    VARCHAR(20) UNIQUE,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  college       VARCHAR(100),
  contact       VARCHAR(50),
  role          VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'hso')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  student_id        VARCHAR(20),
  appointment_type  VARCHAR(10) NOT NULL CHECK (appointment_type IN ('phex', 'dt')),
  appointment_date  DATE NOT NULL,
  time_slot         VARCHAR(20) NOT NULL,
  booking_code      VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'attended', 'cleared', 'cancelled')),
  hso_notes         TEXT,
  attended_at       TIMESTAMP,
  cleared_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, appointment_type)
);

-- Forms table (MEF and DEF data)
CREATE TABLE IF NOT EXISTS forms (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  form_type    VARCHAR(10) NOT NULL CHECK (form_type IN ('mef', 'def')),
  form_data    JSONB NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, form_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_date      ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_type      ON appointments(appointment_type);
CREATE INDEX IF NOT EXISTS idx_appointments_user      ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date_slot ON appointments(appointment_date, time_slot, appointment_type);

-- Seed an HSO admin account (change password after setup)
-- Password: hso_admin_2026 (hashed)
-- Run: node -e "const b=require('bcryptjs'); b.hash('hso_admin_2026',12).then(h=>console.log(h))"
-- Then insert the hash below
-- INSERT INTO users (email, password_hash, first_name, last_name, role)
-- VALUES ('hso@dlsu.edu.ph', '<hash_here>', 'HSO', 'Admin', 'hso');
