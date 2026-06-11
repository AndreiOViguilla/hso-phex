const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "hso_phex_fallback_secret_2026";

function authMiddleware(req, res, next) {
  // Support both Bearer token (header) and session
  if (req.session?.userId) {
    req.user = {
      id:        req.session.userId,
      studentId: req.session.studentId,
      email:     req.session.email,
      role:      req.session.role,
    };
    return next();
  }
  // Fallback to JWT Bearer token
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function hsoOnly(req, res, next) {
  if (!["admin", "master", "nurse"].includes(req.user?.role))
    return res.status(403).json({ error: "HSO staff only." });
  next();
}

module.exports = { authMiddleware, hsoOnly };