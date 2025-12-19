// Load .env variables if needed specifically here (though index.js should handle it)
// require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const path = require('path'); // Keep path for dotenv config below if needed

// Rate limiter for payment endpoints (stricter)
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { msg: 'Too many payment requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false
});

// Debug log to check the environment variable *when this module is loaded*
console.log('[DEBUG paymentRoutes.js] STRIPE_SECRET_KEY value:', process.env.STRIPE_SECRET_KEY);

// Initialize Stripe with your secret key from environment variables
const stripeSecretKeyToUse = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKeyToUse) {
  console.error("FATAL: STRIPE_SECRET_KEY is missing from process.env when initializing Stripe in paymentRoutes.js. Server cannot start.");
  // Optional: throw new Error('Stripe Secret Key is missing');
  process.exit(1); // Exit if key is missing
}
const stripe = require('stripe')(stripeSecretKeyToUse);

const User = require('../models/User'); // Ensure path is correct
const auth = require('../middleware/authMiddleware'); // Ensure path is correct

// @route   POST api/payments/create-checkout-session
router.post('/create-checkout-session', paymentLimiter, auth, async (req, res) => {
  const { priceId, planName } = req.body;

  // --- Input Validation ---
  if (!priceId || !planName) {
    console.error('[Stripe Checkout] Error: Missing Price ID or Plan Name in request body');
    return res.status(400).json({ msg: 'Missing Price ID or Plan Name' });
  }
  // Load dotenv again just for price IDs if not globally available
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const validPriceIds = [process.env.STRIPE_PREMIUM_PRICE_ID, process.env.STRIPE_ELITE_PRICE_ID];
   if (!process.env.STRIPE_PREMIUM_PRICE_ID || !process.env.STRIPE_ELITE_PRICE_ID) {
     console.error('[Stripe Checkout] Error: Stripe Price IDs not found in environment variables.');
     return res.status(500).json({ msg: 'Server configuration error: Price IDs missing.' });
   }
  if (!validPriceIds.includes(priceId)) {
    console.error(`[Stripe Checkout] Error: Invalid Price ID received: ${priceId}. Valid IDs: ${validPriceIds.join(', ')}`);
    return res.status(400).json({ msg: 'Invalid Price ID' });
  }
  // -------------------------

  if (!req.user || !req.user.id) {
    console.error('[Stripe Checkout] Error: User ID not found in authenticated request.');
    return res.status(401).json({ msg: 'User not authenticated' });
  }
  const userId = req.user.id;

  // --- Get Frontend URL ---
  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl) {
      console.error('[Stripe Checkout] Error: CLIENT_URL is not defined in the .env file.');
      return res.status(500).json({ msg: 'Server configuration error: CLIENT_URL missing.' });
  }
  // ------------------------

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[Stripe Checkout] Error: User not found in database with ID: ${userId}`);
      return res.status(404).json({ msg: 'User not found' });
    }

    let customerId = user.stripeCustomerId;

    // --- Create Stripe Customer ---
    if (!customerId) {
      console.log(`[Stripe Checkout] Creating new Stripe customer for user ID: ${userId}`);
      const customer = await stripe.customers.create({
        email: user.email || `${user.username}@example.com`,
        name: user.username,
        metadata: { mongoUserId: userId.toString() },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
      console.log(`[Stripe Checkout] Created Stripe Customer ID ${customerId} for user ID: ${userId}`);
    } else {
      console.log(`[Stripe Checkout] Using existing Stripe Customer ID ${customerId} for user ID: ${userId}`);
    }
    // ----------------------------

    // --- Create Checkout Session ---
    console.log(`[Stripe Checkout] Creating session for Price ID: ${priceId} | Customer: ${customerId}`);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${clientUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/pricing?canceled=true`,
      metadata: { userId: userId.toString(), selectedPlan: planName },
    });
    // -----------------------------

    console.log(`[Stripe Checkout] Session created successfully with ID: ${session.id}`);
    res.json({ id: session.id });

  } catch (err) {
    console.error('[Stripe Checkout] Server Error creating session:', err); // Log full error
    res.status(500).json({ msg: 'Server Error creating checkout session' });
  }
});

// --- Webhook Placeholder ---
/*
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => { ... });
*/

module.exports = router;

