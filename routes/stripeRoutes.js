// server/routes/stripeRoutes.js - Complete with Subscription Features

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const { PLAN_LIMITS } = require('../middleware/subscriptionMiddleware');

// Price mapping - Use a function to get fresh env vars
const getPlanFromPriceId = (priceId) => {
    // Direct mapping from environment variables
    const priceMapping = {
        [process.env.STRIPE_PRICE_STARTER]: 'starter',
        [process.env.STRIPE_PRICE_PRO]: 'pro',
        [process.env.STRIPE_PRICE_PREMIUM]: 'premium',
        [process.env.STRIPE_PRICE_ELITE]: 'elite'
    };

    // Also check hardcoded price IDs as fallback (LIVE price IDs)
    const hardcodedMapping = {
        // Monthly
        'price_1SfTvNCd6gxWUimRapg2v7zC': 'starter',
        'price_1SfTxUCd6gxWUimRfpe40Nr2': 'pro',
        'price_1SfU0WCd6gxWUimRjjA8XnFr': 'premium',
        'price_1SfU1VCd6gxWUimReOuVaFb4': 'elite',
        // Yearly
        'price_1SfTvNCd6gxWUimR5g3pUz9g': 'starter',
        'price_1SfTxUCd6gxWUimRDKXxf5B9': 'pro',
        'price_1SfU0WCd6gxWUimRj1tdL545': 'premium',
        'price_1SfU1VCd6gxWUimR0tUeO70P': 'elite'
    };

    console.log(`[Stripe] Looking up plan for price ID: ${priceId}`);
    console.log(`[Stripe] Env price IDs: starter=${process.env.STRIPE_PRICE_STARTER}, pro=${process.env.STRIPE_PRICE_PRO}, premium=${process.env.STRIPE_PRICE_PREMIUM}, elite=${process.env.STRIPE_PRICE_ELITE}`);

    const plan = priceMapping[priceId] || hardcodedMapping[priceId] || 'starter';
    console.log(`[Stripe] Resolved plan: ${plan}`);
    return plan;
};

// @route   POST /api/stripe/create-checkout-session
// @desc    Create Stripe checkout session
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { priceId } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create or get Stripe customer
        let customerId = user.subscription?.stripeCustomerId;

        // Try to verify existing customer, create new one if missing
        if (customerId) {
            try {
                await stripe.customers.retrieve(customerId);
            } catch (customerError) {
                // Customer doesn't exist (likely test mode ID in live mode)
                console.log(`[Stripe] Customer ${customerId} not found, creating new one`);
                customerId = null;
            }
        }

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user._id.toString()
                }
            });
            customerId = customer.id;

            user.subscription = user.subscription || {};
            user.subscription.stripeCustomerId = customerId;
            await user.save();
            console.log(`[Stripe] Created new customer: ${customerId}`);
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/pricing?canceled=true`,
            metadata: {
                userId: user._id.toString()
            }
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        console.error('Stripe error details:', error.message, error.type, error.code);
        res.status(500).json({
            error: 'Failed to create checkout session',
            details: error.message,
            type: error.type,
            code: error.code
        });
    }
});

// NOTE: Webhook is now handled directly in app.js BEFORE body parsing middleware
// This ensures the raw body is preserved for Stripe signature verification

// @route   GET /api/stripe/subscription
// @desc    Get current user subscription
// @access  Private
router.get('/subscription', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('subscription');
        res.json(user.subscription || { status: 'free' });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

// @route   GET /api/stripe/plan-limits
// @desc    Get current user's plan and limits
// @access  Private
router.get('/plan-limits', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const userPlan = user?.subscription?.status || 'free';
        const limits = PLAN_LIMITS[userPlan];

        // Check if subscription is expired
        let isExpired = false;
        if (userPlan !== 'free' && user.subscription?.currentPeriodEnd) {
            isExpired = new Date() > user.subscription.currentPeriodEnd;
            if (isExpired) {
                user.subscription.status = 'free';
                await user.save();
            }
        }

        // Get current usage
        const usage = {};
        
        try {
            const Watchlist = require('../models/Watchlist');
            usage.watchlists = await Watchlist.countDocuments({ user: user._id });
        } catch (error) {
            // Model doesn't exist yet
            usage.watchlists = 0;
        }
        
        try {
            const Prediction = require('../models/Prediction');
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            usage.predictionsThisMonth = await Prediction.countDocuments({ 
                user: user._id,
                createdAt: { $gte: startOfMonth }
            });
        } catch (error) {
            // Model doesn't exist yet
            usage.predictionsThisMonth = 0;
        }

        res.json({
            success: true,
            data: {
                plan: isExpired ? 'free' : userPlan,
                limits,
                usage,
                subscription: {
                    currentPeriodEnd: user.subscription?.currentPeriodEnd,
                    cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd
                }
            }
        });
    } catch (error) {
        console.error('Get plan limits error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get plan limits' 
        });
    }
});

// @route   GET /api/stripe/check-feature/:feature
// @desc    Check if user has access to a specific feature
// @access  Private
router.get('/check-feature/:feature', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const userPlan = user?.subscription?.status || 'free';
        const limits = PLAN_LIMITS[userPlan];
        const feature = req.params.feature;

        const hasAccess = limits[feature] === true || limits[feature] === -1;

        res.json({
            success: true,
            data: {
                hasAccess,
                plan: userPlan,
                feature,
                value: limits[feature]
            }
        });
    } catch (error) {
        console.error('Check feature error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check feature access' 
        });
    }
});

// @route   POST /api/stripe/cancel-subscription
// @desc    Cancel subscription
// @access  Private
router.post('/cancel-subscription', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription?.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        user.subscription.cancelAtPeriodEnd = true;
        await user.save();

        res.json({ message: 'Subscription will cancel at period end' });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// @route   POST /api/stripe/portal
// @desc    Create billing portal session
// @access  Private
router.post('/portal', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription?.stripeCustomerId) {
            return res.status(400).json({ error: 'No Stripe customer found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: user.subscription.stripeCustomerId,
            return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/settings`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

module.exports = router;