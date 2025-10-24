// server/routes/userRoutes.js

const express = require('express');
const router = express.Router(); // Correctly initialize router once

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../../middleware/auth'); // Assuming this path is correct for your auth middleware

// @route   POST api/users/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    // Validation middleware for registration
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
    const { username, email, password } = req.body;

    try {
      // Check if user with this email already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User with this email already exists' });
      }

      // Check if username is already taken
      user = await User.findOne({ username });
      if (user) {
        return res.status(400).json({ msg: 'Username already taken' });
      }

      // Create a new user instance
      user = new User({ username, email, password });

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      // Save the user to the database
      await user.save();

      // Create JWT payload
      const payload = { user: { id: user.id } };

      // Sign the token and send it back with user info
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 }, // Token expires in 1 hour
        (err, token) => {
          if (err) throw err;
          res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
        }
      );
    } catch (err) {
      console.error('Server Error in /api/users/register:', err.message);
      // More specific error logging for Mongoose validation errors
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
    // Validation middleware for login
    check('username', 'Username is required').not().isEmpty(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // Find user by username
      let user = await User.findOne({ username });

      if (!user) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      // Create JWT payload
      const payload = { user: { id: user.id } };

      // Sign the token and send it back with user info
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 },
        (err, token) => {
          if (err) throw err;
          res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
        }
      );
    } catch (err) {
      console.error('Server Error in /api/users/login:', err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET api/users/auth
// @desc    Get authenticated user (for token validation)
// @access  Private
// This route uses an 'auth' middleware to verify the token
// You MUST have a `server/middleware/auth.js` file for this to work.
router.get('/auth', auth, async (req, res) => {
    try {
        // req.user is set by the auth middleware if token is valid
        const user = await User.findById(req.user.id).select('-password'); // -password means don't return the password hash
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;