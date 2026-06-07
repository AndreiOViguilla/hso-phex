const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "hso_phex_fallback_secret_2026";

function authMiddleware(req, res, next) {
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
  if (req.user?.role !== "hso") return res.status(403).json({ error: "HSO staff only." });
  next();
}

module.exports = { authMiddleware, hsoOnly };