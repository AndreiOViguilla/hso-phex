require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const session      = require("express-session");
const MongoStore   = require("connect-mongo");
const connectDB    = require("./db");
const seedSlots    = require("./services/seedSlots");

const authRoutes        = require("./routes/auth");
const studentRoutes     = require("./routes/students");
const appointmentRoutes = require("./routes/appointments");
const formRoutes        = require("./routes/forms");
const hsoRoutes         = require("./routes/hso");

const { startAutoCancel } = require("./services/autoCancel");

const app  = express();
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await seedSlots();

  const allowedOrigins = [
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.set("trust proxy", 1);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));

  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || "hso_phex_session_secret_2026",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 7 * 24 * 60 * 60,
      autoRemove: "native",
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  app.use("/api/auth",         authRoutes);
  app.use("/api/students",     studentRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/forms",        formRoutes);
  app.use("/api/hso",          hsoRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  startAutoCancel();

  app.listen(PORT, () => console.log(`HSO PHEx backend running on port ${PORT}`));
}

start().catch(console.error);