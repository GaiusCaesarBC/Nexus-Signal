const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber'); // Import the new model

// @route   POST api/waitlist/join
// @desc    Add a new email to the waitlist
// @access  Public
router.post('/join', async (req, res) => {
  const { email } = req.body;
  console.log(`[Waitlist] Received request to add email: ${email}`);

  // Basic validation
  if (!email) {
    return res.status(400).json({ msg: 'Please enter a valid email address.' });
  }

  try {
    // Check if email already exists
    let subscriber = await Subscriber.findOne({ email });

    if (subscriber) {
      console.log(`[Waitlist] Email already exists: ${email}`);
      // If it exists, we still send a "success" so it looks the same to the user
      return res.status(200).json({ msg: 'You are already on the waitlist!' });
    }

    // If new, create and save the new subscriber
    console.log(`[Waitlist] Email is new. Creating entry for: ${email}`);
    subscriber = new Subscriber({
      email,
    });

    await subscriber.save();

    console.log(`[Waitlist] Successfully saved new email: ${email}`);
    // Send a "Created" status back
    return res.status(201).json({ msg: 'Email successfully added to waitlist.' });

  } catch (err) {
    // This will catch validation errors (like a bad email format)
    // or database errors.
    if (err.name === 'ValidationError') {
      console.error(`[Waitlist] Validation error: ${err.message}`);
      return res.status(400).json({ msg: 'Please enter a valid email address.' });
    }
    
    console.error(`[Waitlist] Server error while saving email: ${err.message}`);
    res.status(500).json({ msg: 'An internal server error occurred. Please try again.' });
  }
});

module.exports = router;

