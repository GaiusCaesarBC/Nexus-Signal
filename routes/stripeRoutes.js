// server/routes/stripeRoutes.js - Complete with Subscription Features

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stripe = require('../config/stripeClient').createStripeClient();
const User = require('../models/User');
const { PLAN_LIMITS, getEffectivePlan } = require('../middleware/subscriptionMiddleware');

// Price mapping - Use a function to get fresh env vars
const { getPlanFromPriceId } = require('../config/stripePrices');
const { subscriptionPeriod } = require('../config/stripeObjects');

// @route   POST /api/stripe/create-checkout-session
// @desc    Create Stripe checkout session
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { priceId } = req.body;
        getPlanFromPriceId(priceId);
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
            success_url: `${require('../config/runtimeSafety').serviceUrl('CLIENT_URL')}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${require('../config/runtimeSafety').serviceUrl('CLIENT_URL')}/pricing?canceled=true`,
            client_reference_id: user._id.toString(),
            metadata: {
                userId: user._id.toString()
            },
            subscription_data: {
                metadata: {
                    userId: user._id.toString()
                }
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

// @route   POST /api/stripe/upgrade-subscription
// @desc    Upgrade or change existing subscription plan (with automatic proration)
// @access  Private
router.post('/upgrade-subscription', auth, async (req, res) => {
    try {
        const { newPriceId } = req.body;
        getPlanFromPriceId(newPriceId);
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has active subscription
        const subscriptionId = user.subscription?.stripeSubscriptionId;
        if (!subscriptionId) {
            return res.status(400).json({ 
                error: 'No active subscription found. Create one first.',
                requiresNewCheckout: true 
            });
        }

        // Retrieve current subscription
        const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPriceId = currentSubscription.items.data[0].price.id;
        const currentPlan = getPlanFromPriceId(currentPriceId);
        const newPlan = getPlanFromPriceId(newPriceId);

        // Prevent changing to same plan
        if (currentPriceId === newPriceId) {
            return res.status(400).json({ 
                error: `Already on ${newPlan} plan` 
            });
        }

        // Update subscription with new price and automatic proration
        const updatedSubscription = await stripe.subscriptions.update(
            subscriptionId,
            {
                items: [
                    {
                        id: currentSubscription.items.data[0].id,
                        price: newPriceId,
                    }
                ],
                // proration_behavior: 'create_prorations' is the default
                // This will automatically create invoice items for the prorated amount
                proration_behavior: 'create_prorations',
                billing_cycle_anchor: 'now', // Start new billing cycle immediately
            }
        );

        // Get the upcoming invoice to show the user their charges
        let upcomingInvoice = null;
        try {
            upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                customer: user.subscription.stripeCustomerId,
            });
        } catch (e) {
            // Upcoming invoice might not exist yet, that's ok
            console.log('[Stripe] No upcoming invoice yet:', e.message);
        }

        // Calculate what they owe or will be credited
        const prorationDetails = {
            fromPlan: currentPlan,
            toPlan: newPlan,
            effectiveDate: subscriptionPeriod(updatedSubscription).start,
            nextBillingDate: subscriptionPeriod(updatedSubscription).end,
            amountDue: upcomingInvoice ? (upcomingInvoice.amount_due / 100) : 0,
            amountCredit: upcomingInvoice ? Math.max(0, -(upcomingInvoice.amount_due / 100)) : 0,
            message: upcomingInvoice && upcomingInvoice.amount_due > 0 
                ? `You'll be charged $${(upcomingInvoice.amount_due / 100).toFixed(2)} for the upgrade`
                : upcomingInvoice && upcomingInvoice.amount_due < 0
                ? `You'll receive a credit of $${Math.abs(upcomingInvoice.amount_due / 100).toFixed(2)}`
                : 'Upgrade applied with automatic proration'
        };

        res.json({
            success: true,
            subscription: {
                status: newPlan,
                currentPeriodStart: subscriptionPeriod(updatedSubscription).start,
                currentPeriodEnd: subscriptionPeriod(updatedSubscription).end,
            },
            proration: prorationDetails
        });

    } catch (error) {
        console.error('Upgrade subscription error:', error);
        res.status(500).json({
            error: 'Failed to upgrade subscription',
            details: error.message
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
        const userPlan = getEffectivePlan(user || {}).plan;
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
            return_url: `${require('../config/runtimeSafety').serviceUrl('CLIENT_URL')}/settings`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// @route   POST /api/stripe/sync-subscription
// @desc    Manually sync user's subscription from Stripe (fix for upgrade bugs)
// @access  Private
// @usage   Call this if subscription didn't update after purchase
router.post('/sync-subscription', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.subscription?.stripeCustomerId) {
            return res.status(400).json({
                success: false,
                error: 'No Stripe customer found. Please purchase a subscription first.'
            });
        }

        const customerId = user.subscription.stripeCustomerId;

        // Get the latest active subscription from Stripe
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 1,
            status: 'active'
        });

        if (subscriptions.data.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No active subscription found in Stripe'
            });
        }

        const stripeSubscription = subscriptions.data[0];
        if (stripeSubscription.customer !== customerId ||
            (stripeSubscription.metadata?.userId && stripeSubscription.metadata.userId !== String(user._id))) {
            return res.status(409).json({ error: 'Subscription ownership mismatch' });
        }
        const paidInvoice = typeof stripeSubscription.latest_invoice === 'object' ? stripeSubscription.latest_invoice
            : await stripe.invoices.retrieve(stripeSubscription.latest_invoice);
        if (!(paidInvoice?.paid === true || paidInvoice?.status === 'paid')) {
            return res.status(409).json({ error: 'Latest invoice is not paid; awaiting billing reconciliation' });
        }
        if (user.subscription.stripeSubscriptionId && user.subscription.stripeSubscriptionId !== stripeSubscription.id) {
            return res.status(409).json({ error: 'A different subscription is attached' });
        }
        const priceId = stripeSubscription.items.data[0].price.id;

        // Map price ID to plan
        const plan = getPlanFromPriceId(priceId);

        const oldPlan = user.subscription.status || 'free';

        // Update subscription
        user.subscription.status = plan;
        user.subscription.stripeSubscriptionId = stripeSubscription.id;
        user.subscription.stripePriceId = priceId;
        user.subscription.currentPeriodStart = subscriptionPeriod(stripeSubscription).start;
        user.subscription.currentPeriodEnd = subscriptionPeriod(stripeSubscription).end;
        user.subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
        user.subscription.paymentStatus = stripeSubscription.status;
        user.subscription.billingInterval = stripeSubscription.items.data[0].price.recurring.interval;
        user.subscription.graceEndsAt = null;

        await user.save();

        console.log(`✅ Manual sync: User ${user._id} subscription updated from ${oldPlan} to ${plan}`);

        res.json({
            success: true,
            message: `Subscription synced: ${oldPlan} → ${plan}`,
            data: {
                newPlan: plan,
                previousPlan: oldPlan,
                currentPeriodEnd: user.subscription.currentPeriodEnd
            }
        });
    } catch (error) {
        console.error('Manual subscription sync error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync subscription',
            details: error.message
        });
    }
});

module.exports = router;
