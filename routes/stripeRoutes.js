// server/routes/stripeRoutes.js - Complete with Subscription Features

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const { PLAN_LIMITS, getEffectivePlan } = require('../middleware/subscriptionMiddleware');

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

        // ═══ LAUNCH PROMO: 25% off for 30 days (auto-expires) ═══
        // Create or reuse a Stripe coupon for the launch discount
        let launchCouponId = null;
        const LAUNCH_PROMO_END = new Date('2026-05-01T00:00:00Z'); // 30 days from launch
        if (new Date() < LAUNCH_PROMO_END) {
            try {
                // Try to retrieve existing coupon
                const coupon = await stripe.coupons.retrieve('LAUNCH25');
                launchCouponId = coupon.id;
            } catch (e) {
                // Create coupon if it doesn't exist
                try {
                    const coupon = await stripe.coupons.create({
                        id: 'LAUNCH25',
                        percent_off: 25,
                        duration: 'repeating',
                        duration_in_months: 3, // Discount applies for first 3 months
                        name: 'Launch Day - 25% Off',
                        redeem_by: Math.floor(LAUNCH_PROMO_END.getTime() / 1000),
                    });
                    launchCouponId = coupon.id;
                    console.log('[Stripe] Created LAUNCH25 coupon');
                } catch (couponErr) {
                    console.log('[Stripe] Coupon creation failed:', couponErr.message);
                }
            }
        }

        // Create checkout session
        const sessionParams = {
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
        };

        // Apply launch discount if active
        if (launchCouponId) {
            sessionParams.discounts = [{ coupon: launchCouponId }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

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
        const { plan: effectivePlan, trial } = getEffectivePlan(user);
        const sub = user.subscription || {};
        res.json({
            ...sub.toObject ? sub.toObject() : sub,
            effectivePlan,
            trial: {
                active: trial,
                used: sub.trialUsed || false,
                endsAt: sub.trialEndsAt || null
            }
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

// @route   POST /api/stripe/start-trial
// @desc    Start 7-day free trial (premium access, once per user)
// @access  Private
router.post('/start-trial', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.subscription?.trialUsed) {
            return res.status(400).json({ success: false, error: 'Free trial already used' });
        }

        // Don't allow trial if user already has a paid plan
        if (user.subscription?.status && user.subscription.status !== 'free') {
            return res.status(400).json({ success: false, error: 'You already have an active subscription' });
        }

        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

        user.subscription = user.subscription || {};
        user.subscription.trialUsed = true;
        user.subscription.trialStartedAt = now;
        user.subscription.trialEndsAt = trialEnd;
        await user.save();

        console.log(`[Trial] User ${user._id} (${user.username}) started 7-day premium trial, ends ${trialEnd.toISOString()}`);

        res.json({
            success: true,
            message: 'Premium trial activated! Enjoy 7 days of full access.',
            trial: {
                startedAt: now,
                endsAt: trialEnd,
                plan: 'premium'
            }
        });
    } catch (error) {
        console.error('Start trial error:', error);
        res.status(500).json({ success: false, error: 'Failed to start trial' });
    }
});

// @route   GET /api/stripe/plan-limits
// @desc    Get current user's plan and limits
// @access  Private
router.get('/plan-limits', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const { plan: effectivePlan, expired, trial } = getEffectivePlan(user);

        if (expired) {
            user.subscription.status = 'free';
            await user.save();
        }

        const limits = PLAN_LIMITS[effectivePlan];

        // Get current usage
        const usage = {};

        try {
            const Watchlist = require('../models/Watchlist');
            usage.watchlists = await Watchlist.countDocuments({ user: user._id });
        } catch (error) {
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
            usage.predictionsThisMonth = 0;
        }

        res.json({
            success: true,
            data: {
                plan: effectivePlan,
                limits,
                usage,
                subscription: {
                    currentPeriodEnd: user.subscription?.currentPeriodEnd,
                    cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd
                },
                trial: {
                    active: trial,
                    used: user.subscription?.trialUsed || false,
                    endsAt: user.subscription?.trialEndsAt || null
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