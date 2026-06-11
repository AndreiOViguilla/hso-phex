const authMiddleware = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }
  req.user = {
    id:        req.session.userId,
    studentId: req.session.studentId,
    email:     req.session.email,
    role:      req.session.role,
  };
  next();
};

function hsoOnly(req, res, next) {
  if (!["admin", "master", "nurse"].includes(req.user?.role))
    return res.status(403).json({ error: "HSO staff only." });
  next();
}

module.exports = { authMiddleware, hsoOnly };