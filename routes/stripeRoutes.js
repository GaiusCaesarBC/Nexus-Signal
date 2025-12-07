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

    // Also check hardcoded price IDs as fallback (from PricingPage.js)
    const hardcodedMapping = {
        'price_1SV9d8CtdTItnGjydNZsbXl3': 'starter',
        'price_1SV9dTCtdTItnGjycfSxQtAg': 'pro',
        'price_1SV9doCtdTItnGjyYb8yG97j': 'premium',
        'price_1SV9eACtdTItnGjyzSNaNYhP': 'elite'
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
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// @route   POST /api/stripe/webhook
// @desc    Handle Stripe webhooks
// @access  Public (but verified)
// NOTE: Raw body parsing is handled in app.js BEFORE express.json() middleware
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    console.log(`[Stripe Webhook] Received webhook request`);
    console.log(`[Stripe Webhook] Signature: ${sig ? 'present' : 'MISSING'}`);
    console.log(`[Stripe Webhook] Body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}`);
    console.log(`[Stripe Webhook] Secret configured: ${process.env.STRIPE_WEBHOOK_SECRET ? 'yes' : 'NO'}`);
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const userId = session.metadata.userId;
            const subscriptionId = session.subscription;

            console.log(`[Stripe Webhook] checkout.session.completed for user ${userId}`);
            console.log(`[Stripe Webhook] Subscription ID: ${subscriptionId}`);

            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscription.items.data[0].price.id;
            const plan = getPlanFromPriceId(priceId);

            console.log(`[Stripe Webhook] Updating user ${userId} to plan: ${plan}`);

            const updatedUser = await User.findByIdAndUpdate(userId, {
                'subscription.status': plan,
                'subscription.stripeSubscriptionId': subscriptionId,
                'subscription.stripeCustomerId': session.customer,
                'subscription.stripePriceId': priceId,
                'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
                'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
                'subscription.cancelAtPeriodEnd': false
            }, { new: true });

            console.log(`✅ Subscription created for user ${userId}: ${plan}`);
            console.log(`[Stripe Webhook] Updated user subscription:`, updatedUser?.subscription);
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const customerId = subscription.customer;

            console.log(`[Stripe Webhook] customer.subscription.updated for customer ${customerId}`);

            const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
            if (user) {
                const priceId = subscription.items.data[0].price.id;
                const plan = getPlanFromPriceId(priceId);

                user.subscription.status = plan;
                user.subscription.stripePriceId = priceId;
                user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
                user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
                await user.save();

                console.log(`✅ Subscription updated for user ${user._id}: ${plan}`);
            } else {
                console.log(`[Stripe Webhook] No user found with stripeCustomerId: ${customerId}`);
            }
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            
            const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
            if (user) {
                user.subscription.status = 'free';
                user.subscription.stripeSubscriptionId = null;
                user.subscription.currentPeriodEnd = null;
                await user.save();

                console.log(`✅ Subscription canceled for user ${user._id}`);
            }
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

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