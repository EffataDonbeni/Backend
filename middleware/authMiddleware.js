const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header("x-auth-token");

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database and add to request
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ msg: "Token is not valid - user not found" });
    }

    if (!user.isActive) {
      return res.status(401).json({ msg: "Account is desactivated" });
    }

    req.user = user; // Now includes role
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};
