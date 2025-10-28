// server/routes/auth.js - **UPDATED with Login Debugging Logs**

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // For input validation

const User = require('../models/User'); // User model
// IMPORTANT: Make sure the path matches your actual file structure
const auth = require('../middleware/authMiddleware'); // <--- IMPORT YOUR EXISTING AUTH MIDDLEWARE

// @route   GET api/auth/me
// @desc    Get logged in user data (requires token)
// @access  Private
// This route uses the 'auth' middleware to verify the token before proceeding.
router.get('/me', auth, async (req, res) => {
    console.log(`[Auth Route /me] Request received for user ID from token: ${req.user.id}`);
    try {
        // req.user.id is populated by the 'auth' middleware after successful token verification.
        // .select('-password') prevents sending the hashed password to the frontend.
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            console.log(`[Auth Route /me] User not found in DB for ID: ${req.user.id}`);
            return res.status(404).json({ msg: 'User not found' });
        }

        console.log(`[Auth Route /me] Successfully fetched user: ${user.email}`);
        res.json(user); // Send the user data (without password)
    } catch (err) {
        console.error('[Auth Route /me] Server error:', err.message);
        res.status(500).send('Server Error');
    }
});

router.post(
    '/register',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            // See if user exists
            let user = await User.findOne({ email });

            if (user) {
                console.log(`Registration failed: User with email ${email} already exists.`);
                return res.status(400).json({ msg: 'User already exists' });
            }

            // Create new user instance
            user = new User({
                email,
                password
            });

            // Hash password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);

            await user.save(); // Save user to database

            // Return jsonwebtoken
            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '1h' }, // Token expires in 1 hour
                (err, token) => {
                    if (err) throw err;
                    res.json({ token });
                    console.log(`Registration successful for ${email}. Token issued.`);
                }
            );

        } catch (err) {
            console.error('Server error during registration:', err.message);
            res.status(500).send('Server error');
        }
    }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
    '/login',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password is required').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // --- DEBUGGING LOGS START ---
        console.log('--- LOGIN ATTEMPT ---');
        console.log('Received Email:', email);
        console.log('Received Password (WARNING: Do NOT log in production):', password); // Be cautious logging raw passwords in prod

        try {
            let user = await User.findOne({ email });

            if (!user) {
                console.log('Login failed: User not found for email:', email);
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }
            console.log('User found. Email:', user.email);
            console.log('Stored hashed password in DB:', user.password);


            // Check if password matches
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                console.log('Login failed: Password mismatch for user:', user.email);
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }
            console.log('Password matched for user:', user.email);

            // --- DEBUGGING LOGS END ---


            // Return jsonwebtoken
            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) throw err;
                    res.json({ token });
                    console.log(`Login successful for ${email}. Token issued.`);
                }
            );

        } catch (err) {
            console.error('Server error during login:', err.message);
            res.status(500).send('Server error');
        }
    }
);

// @route   PUT api/auth/update-profile
// @desc    Update logged in user's profile and settings
// @access  Private
router.put('/update-profile', auth, async (req, res) => {
    console.log(`[Auth Route /update-profile] Request received for user ID: ${req.user.id}`);
    const { username, email, currentPassword, newPassword, notifications, appPreferences } = req.body;

    try {
        let user = await User.findById(req.user.id);

        if (!user) {
            console.log(`[Auth Route /update-profile] User not found for ID: ${req.user.id}`);
            return res.status(404).json({ msg: 'User not found' });
        }

        // Update basic profile fields if provided
        if (username !== undefined) user.username = username; // Assuming 'username' field in User model
        if (email !== undefined) {
            // Optional: Add email validation and uniqueness check here if allowed to change
            user.email = email;
        }

        // Update nested settings fields
        if (notifications !== undefined) user.notifications = notifications; // Assuming 'notifications' field in User model
        if (appPreferences !== undefined) user.appPreferences = appPreferences; // Assuming 'appPreferences' field in User model


        // Handle password change if newPassword is provided
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ msg: 'Current password is required to change password.' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Current password is incorrect.' });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            console.log(`[Auth Route /update-profile] Password updated for user: ${user.email}`);
        }

        await user.save(); // Save updated user to database

        // Return the updated user data (without password)
        const updatedUser = await User.findById(req.user.id).select('-password');
        console.log(`[Auth Route /update-profile] Successfully updated user: ${updatedUser.email}`);
        res.json({ msg: 'Settings updated successfully', user: updatedUser });

    } catch (err) {
        console.error('[Auth Route /update-profile] Server error:', err.message);
        res.status(500).send('Server Error');
    }
});
module.exports = router;