const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const authController = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
const { restrictTo } = require("../middleware/roleMiddleware");

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  [
    check("username", "Username is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("role").optional().isIn(["admin", "user"]), 
  ],
  authController.register
);

// @route   POST api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  authController.login
);

// @route   GET api/auth/me
// @desc    Get logged in user
// @access  Private
router.get("/me", auth, authController.getMe);

// @route   GET api/auth/users
// @desc    Get all users
// @access  Private (Admin only)
router.get("/users", auth, restrictTo('admin'), authController.getAllUsers);

module.exports = router;
