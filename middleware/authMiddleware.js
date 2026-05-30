const jwt = require("jsonwebtoken");
const config = require("../config/appConfig");

const JWT_SECRET = config.jwtSecret;

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Role-Based Access Control
 * Checks if user has required role for resource access
 */
function roleBasedAccess(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user context" });
    }

    const userRole = req.user.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Forbidden: Insufficient permissions",
        requiredRole: allowedRoles,
        userRole: userRole
      });
    }

    return next();
  };
}

module.exports = {
  authRequired,
  roleBasedAccess,
  JWT_SECRET,
};
