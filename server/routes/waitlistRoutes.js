const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber'); // Import the new model

// @route   POST api/waitlist/join
// @desc    Add a new email to the waitlist
// @access  Public
router.post('/join', async (req, res) => {
  const { email } = req.body;

  // Basic email validation
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ msg: 'Please provide a valid email address.' });
  }

  try {
    // Check if email already exists
    let subscriber = await Subscriber.findOne({ email });

    if (subscriber) {
      // Email is already on the list, just send a success response
      return res.status(200).json({ msg: 'You are already on our list!' });
    }

    // If new, create and save the subscriber
    subscriber = new Subscriber({
      email,
    });

    await subscriber.save();

    // Send success response
    res.status(201).json({ msg: 'Success! You have been added to the waitlist.' });

  } catch (err) {
    console.error('Waitlist Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
