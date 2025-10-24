const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator'); // Import express-validator
const User = require('../models/User');
const auth = require('../../middleware/auth'); // Assuming you have an auth middleware

// @route   POST api/users/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    // Validation middleware
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Correctly destructure all fields, including email
    const { username, email, password } = req.body; // <-- CORRECTED THIS LINE!

    try {
      let user = await User.findOne({ email }); // Check by email, as it's unique
      if (user) {
        return res.status(400).json({ msg: 'User with this email already exists' });
      }

      user = await User.findOne({ username }); // Also check by username, as it's unique
      if (user) {
        return res.status(400).json({ msg: 'Username already taken' });
      }

      user = new User({ username, email, password }); // <-- CORRECTED THIS LINE!

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = { user: { id: user.id } };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 }, // Token expires in 1 hour (3600 seconds)
        (err, token) => {
          if (err) throw err;
          res.json({ token, user: { id: user.id, username: user.username, email: user.email } }); // Also send back user data
        }
      );
    } catch (err) {
      console.error('Server Error in /api/users/register:', err.message);
      // More specific error logging for Mongoose validation
      if (err.name === 'ValidationError') {
          return res.status(400).json({ msg: err.message });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   POST api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    // Validation middleware
    check('username', 'Username is required').not().isEmpty(), // Or check by email, depending on your login strategy
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body