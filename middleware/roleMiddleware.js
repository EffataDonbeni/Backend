const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Access denied: Insufficient role" });
    }
    next();
  };
};

module.exports = { restrictTo };
