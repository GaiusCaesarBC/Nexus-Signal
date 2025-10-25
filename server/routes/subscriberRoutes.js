// server/routes/subscriberRoutes.js
const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber'); // <--- CORRECT: Imports your Subscriber model

// @route   POST api/subscribers
// @desc    Add an email to the subscriber list
// @access  Public
router.post('/', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ msg: 'Email is required.' });
    }

    try {
        // Check if email already exists in the Subscriber collection
        let subscriber = await Subscriber.findOne({ email });
        if (subscriber) {
            return res.status(409).json({ msg: 'This email is already subscribed.' });
        }

        subscriber = new Subscriber({ email }); // Use your Subscriber model
        await subscriber.save();
        res.status(201).json({ msg: 'Successfully subscribed!' });

    } catch (err) {
        console.error('Error adding email to subscriber list:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;