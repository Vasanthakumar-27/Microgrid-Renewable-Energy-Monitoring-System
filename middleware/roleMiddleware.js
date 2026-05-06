function roleCheck(role) {
  return (req, res, next) => {
    const userRole = req.user?.role || req.headers.role;

    if (userRole === role) {
      next();
      return;
    }

    res.status(403).json({ message: "Access Denied" });
  };
}

module.exports = roleCheck;
