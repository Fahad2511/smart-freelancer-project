// Attach after authentication middleware when role-restricted routes are introduced.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication is required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to access this resource",
      });
    }

    next();
  };
}

module.exports = requireRole;
