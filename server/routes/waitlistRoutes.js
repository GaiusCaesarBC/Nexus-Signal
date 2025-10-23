const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber'); // Make sure this path is correct

// @route   POST /api/waitlist/join
// @desc    Add a new email to the waitlist
// @access  Public
router.post('/join', async (req, res) => {
    const { email } = req.body;

    console.log(`[Waitlist] Received request to add email: ${email}`);

    // Simple validation
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        console.warn(`[Waitlist] Invalid email format: ${email}`);
        return res.status(400).json({ msg: 'Please provide a valid email address.' });
    }

    try {
        // Check if email already exists (case-insensitive)
        let subscriber = await Subscriber.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (subscriber) {
            console.log(`[Waitlist] Email already exists: ${email}`);
            // Send a 200 OK, but with a specific message
            return res.status(200).json({ msg: 'You are already on the waitlist!' });
        }

        // Email is new, create and save it
        console.log(`[Waitlist] Email is new. Creating entry for: ${email}`);
        subscriber = new Subscriber({
            email: email.toLowerCase() // Store emails in lowercase
        });

        await subscriber.save();
        console.log(`[Waitlist] Successfully saved new email: ${email}`);

        // Send a 201 Created status
        return res.status(201).json({ msg: 'Email successfully added to waitlist.' });

    } catch (err) {
        console.error('[Waitlist] Server error while saving email:', err.message);
        return res.status(500).json({ msg: 'Server error. Please try again later.' });
    }
});

module.exports = router;

