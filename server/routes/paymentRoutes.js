const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Initialize Stripe with your secret key
const User = require('../models/User'); // Assuming your User model is here
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// @route   POST api/payments/create-checkout-session
// @desc    Create a Stripe Checkout Session for subscription
// @access  Private (user must be logged in)
router.post('/create-checkout-session', auth, async (req, res) => {
  const { priceId, planName } = req.body; // priceId should be Stripe Price ID, planName for your internal tracking

  // Ensure the user exists and has a valid ID from the auth middleware
  if (!req.user || !req.user.id) {
    return res.status(401).json({ msg: 'User not authenticated' });
  }

  try {
    // Look up the user to get their email for Stripe customer creation/lookup
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let customerId;

    // If user already has a Stripe Customer ID, use it. Otherwise, create one.
    if (user.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email, // Assuming your User model has an 'email' field. If not, consider adding it or use username.
        metadata: {
          userId: user.id.toString(), // Link to your internal user ID
        },
      });
      customerId = customer.id;
      // Save the new customer ID to your user model
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId, // Use the existing or newly created customer
      line_items: [
        {
          price: priceId, // The Stripe Price ID for Premium or Elite
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id.toString(),
        planName: planName,
      },
    });

    res.json({ id: session.id }); // Send the session ID back to the frontend
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// IMPORTANT: WEBHHOOK ENDPOINT (to be added next)
// This is a placeholder. A separate, public endpoint is needed for Stripe webhooks.
// router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
//    ... webhook logic here ...
// });

module.exports = router;
