require("dotenv").config();
const express      = require("express");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const cors         = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const path         = require("path");
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
    process.env.FRONTEND_URL,
    process.env.RENDER_EXTERNAL_URL,
    "https://hso-phex-backend.onrender.com",
    "https://hso-phex.vercel.app",
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.startsWith("http://localhost:")) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));

  app.set("trust proxy", 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // keep disabled so React build works
  }));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "2mb" })); // cap payload size

  // ── NoSQL injection prevention ────────────────────────────────────────────
  // Strips $ and . from req.body, req.params, req.query so attackers
  // can't inject MongoDB operators like { "$gt": "" }
  app.use(mongoSanitize({
    replaceWith: "_",        // replace instead of delete so fields aren't silently dropped
    onSanitize: ({ req, key }) => {
      console.warn(`[SECURITY] Sanitized key "${key}" from ${req.ip} ${req.path}`);
    },
  }));

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please wait 15 minutes and try again." },
  });
  app.use(globalLimiter);
  app.use("/api/auth/login",    authLimiter);
  app.use("/api/auth/register", authLimiter);

  // ── Session ───────────────────────────────────────────────────────────────
  if (!process.env.SESSION_SECRET) {
    console.warn("[SECURITY] SESSION_SECRET not set — using insecure fallback. Set it in .env!");
  }
  app.use(session({
    secret: process.env.SESSION_SECRET || "hso_phex_session_secret_2026",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 8 * 60 * 60,          // 8 hours (down from 7 days)
      autoRemove: "native",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",         // upgraded from "lax" — blocks cross-site requests
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use("/api/auth",         authRoutes);
  app.use("/api/students",     studentRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/forms",        formRoutes);
  app.use("/api/hso",          hsoRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // ── Serve React frontend in production ────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    const frontendPath = path.join(__dirname, "../../frontend/build");
    app.use(express.static(frontendPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  }

  // ── Global error handler ──────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    // Never leak stack traces to the client
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(err.status || 500).json({ error: "Something went wrong." });
  });

  startAutoCancel();

  app.listen(PORT, () => console.log(`HSO PHEx backend running on port ${PORT}`));
}

start().catch(console.error);