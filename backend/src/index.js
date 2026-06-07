require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const connectDB    = require("./db");
const seedSlots    = require("./services/seedSlots");

const authRoutes        = require("./routes/auth");
const studentRoutes     = require("./routes/students");
const appointmentRoutes = require("./routes/appointments");
const formRoutes        = require("./routes/forms");
const hsoRoutes         = require("./routes/hso");

const app  = express();
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await seedSlots();

  app.use(cors({
    origin: [
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  }));

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/auth",         authRoutes);
  app.use("/api/students",     studentRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/forms",        formRoutes);
  app.use("/api/hso",          hsoRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.listen(PORT, () => console.log(`HSO PHEx backend running on port ${PORT}`));
}

start().catch(console.error);