// server/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // For input validation

const User = require('../models/User'); // User model
// IMPORTANT: Make sure the path matches your actual file structure for authMiddleware
const auth = require('../middleware/authMiddleware'); // <--- IMPORT YOUR EXISTING AUTH MIDDLEWARE

// @route   GET api/auth/me
// @desc    Get logged in user data (requires token from HttpOnly cookie)
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

// @route   POST api/auth/register
// @desc    Register user and issue HttpOnly cookie
// @access  Public
router.post(
    '/register',
    [ // Middleware array for input validation
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
        body('username', 'Username is required').notEmpty().isLength({ min: 3 })
    ],
    async (req, res) => { // The actual route handler function
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('[Auth Route /register] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, username } = req.body;

        try {
            // See if user exists by email
            let user = await User.findOne({ email });

            if (user) {
                console.log(`[Auth Route /register] Registration failed: User with email ${email} already exists.`);
                return res.status(400).json({ msg: 'User already exists' });
            }

            // Also check if username exists (if it's unique in your model)
            let userByUsername = await User.findOne({ username });
            if (userByUsername) {
                console.log(`[Auth Route /register] Registration failed: Username ${username} already taken.`);
                return res.status(400).json({ msg: 'Username already taken' });
            }

            // Create new user instance
            user = new User({
                email,
                password,
                username
            });

            // Hash password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);

            await user.save(); // Save user to database
            console.log(`[Auth Route /register] New user created: ${user.email} (Username: ${user.username})`);

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
                    if (err) {
                        console.error('[Auth Route /register] JWT signing error:', err.message);
                        throw err;
                    }
                  // Inside the jwt.sign callback for /login and /register

             res.cookie('token', token, {
    httpOnly: true,
    secure: true, // <-- THIS MUST BE TRUE
    sameSite: 'None', // <-- THIS MUST BE 'None'
    maxAge: 3600000
});
// NOTE: If you are testing locally (http://localhost), setting 'secure: true' will prevent the cookie from being set.
// For local testing, you must comment out 'secure: true' in app.js and auth.js. 
// For the live site (https://www.nexussignal.ai), it MUST be set to true.
                    // Send success response (without the token in the body)
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
// @desc    Authenticate user & issue HttpOnly cookie
// @access  Public
router.post(
    '/login',
    [ // Middleware array for input validation
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password is required').exists()
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

            // Check if password matches
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                console.log('[Auth Route /login] Login failed: Password mismatch for user:', user.email);
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }
            console.log('[Auth Route /login] Password matched for user:', user.email);

            // Return jsonwebtoken
            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET, // Make sure JWT_SECRET is defined in your .env file
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) {
                        console.error('[Auth Route /login] JWT signing error:', err.message);
                        throw err;
                    }
                    // CRITICAL CHANGE: SET TOKEN AS HTTPONLY COOKIE
                 // Inside the jwt.sign callback for /login and /register

res.cookie('token', token, {
    httpOnly: true,
    secure: true, // <<< CRITICAL: MUST BE TRUE for HTTPS (Vercel/Render)
    sameSite: 'None', // <<< CRITICAL: MUST BE 'None' for cross-domain cookie sending
    maxAge: 3600000 // 1 hour expiration in ms
});
                    // Send success response (without the token in the body)
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
// @desc    Logout user by clearing HttpOnly cookie
// @access  Private
router.post('/logout', auth, (req, res) => {
   // Inside router.post('/logout', auth, ...)
 // Inside router.post('/logout', auth, ...)
res.clearCookie('token', {
    httpOnly: true,
    secure: true, // Set explicitly to true
    sameSite: 'None' // Set explicitly to 'None'
});
    res.json({ msg: 'Logged out successfully' });
    console.log(`[Auth Route /logout] User ${req.user.id} logged out. HttpOnly cookie cleared.`);
});


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
            // Example: if (email && email !== user.email && await User.findOne({ email })) { return res.status(400).json({ msg: 'Email already in use' }); }
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