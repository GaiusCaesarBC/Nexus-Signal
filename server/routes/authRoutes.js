// server/routes/authRoutes.js - FULL & CORRECTED

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// --- CRITICAL: Hardcoded Cookie settings for PROD (Vercel <-> Render) ---
const cookieOptions = {
    httpOnly: true,
    secure: true,     // MUST be true for cross-domain + HTTPS
    sameSite: 'None', // MUST be 'None' for cross-domain
    maxAge: 3600000   // 1 hour (for login/register token)
};
// --- END CRITICAL SETTINGS ---

// @route   GET api/auth/me
router.get('/me', auth, async (req, res) => {
    console.log(`[Auth Route /me] Request received for user ID from token: ${req.user.id}`);
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            console.log(`[Auth Route /me] User not found in DB for ID: ${req.user.id}`);
            return res.status(404).json({ msg: 'User not found' });
        }
        console.log(`[Auth Route /me] Successfully fetched user: ${user.email}`);
        res.json(user);
    } catch (err) {
        console.error('[Auth Route /me] Server error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/auth/register
router.post(
    '/register',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
        body('username', 'Username is required').notEmpty().isLength({ min: 3 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('[Auth Route /register] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password, username } = req.body;
        try {
            let user = await User.findOne({ email });
            if (user) {
                console.log(`[Auth Route /register] Registration failed: User with email ${email} already exists.`);
                return res.status(400).json({ msg: 'User already exists' });
            }
            let userByUsername = await User.findOne({ username });
            if (userByUsername) {
                console.log(`[Auth Route /register] Registration failed: Username ${username} already taken.`);
                return res.status(400).json({ msg: 'Username already taken' });
            }
            user = new User({ email, password, username });
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();
            console.log(`[Auth Route /register] New user created: ${user.email} (Username: ${user.username})`);

            const payload = { user: { id: user.id } };
            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) {
                        console.error('[Auth Route /register] JWT signing error:', err.message);
                        throw err;
                    }
                    res.cookie('token', token, cookieOptions); // <-- Use the fixed options
                    res.json({ success: true, msg: "Registration successful" });
                    console.log(`[Auth Route /register] Registration successful for ${email}. HttpOnly cookie issued.`);
                }
            );
        } catch (err) {
            console.error('[Auth Route /register] Server error during registration:', err.message);
            res.status(500).send('Server error');
        }
    }
);

// @route   POST api/auth/login
router.post(
    '/login',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('('password', 'Password is required').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('[Auth Route /login] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password } = req.body;
        try {
            let user = await User.findOne({ email });
            if (!user) {
                console.log('[Auth Route /login] Login failed: User not found for email:', email);
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }
            console.log('[Auth Route /login] User found. Email:', user.email);
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                console.log('[Auth Route /login] Login failed: Password mismatch for user:', user.email);
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }
            console.log('[Auth Route /login] Password matched for user:', user.email);

            const payload = { user: { id: user.id } };
            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) {
                        console.error('[Auth Route /login] JWT signing error:', err.message);
                        throw err;
                    }
                    res.cookie('token', token, cookieOptions); // <-- Use the fixed options
                    res.json({ success: true, msg: "Logged in successfully" });
                    console.log(`[Auth Route /login] Login successful for ${email}. HttpOnly cookie issued.`);
                }
            );
        } catch (err) {
            console.error('[Auth Route /login] Server error during login:', err.message);
            res.status(500).send('Server error');
        }
    }
);

// @route   POST api/auth/logout
router.post('/logout', auth, (req, res) => {
    res.clearCookie('token', cookieOptions); // <-- Use the fixed options
    res.json({ msg: 'Logged out successfully' });
    console.log(`[Auth Route /logout] User ${req.user?.id || 'unknown'} logged out. HttpOnly cookie cleared.`);
});

// @route   PUT api/auth/update-profile
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
        if (username !== undefined) user.username = username;
        if (email !== undefined) {
            // Optional: Add email validation and uniqueness check here if allowed to change
            if (email && email !== user.email && await User.findOne({ email })) { return res.status(400).json({ msg: 'Email already in use' }); }
            user.email = email;
        }

        // Update nested settings fields (ensure your User model supports these fields)
        if (notifications !== undefined) user.notifications = notifications;
        if (appPreferences !== undefined) user.appPreferences = appPreferences;

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