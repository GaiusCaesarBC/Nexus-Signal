// server/app.js - Updated with Portfolio, Predictions, Chat, Alerts, and PATTERN Routes

require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'FOUND ✓' : 'MISSING ✗');
console.log('First 20 chars:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) : 'N/A');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const journalRoutes = require('./routes/journalRoutes');
const screenerRoutes = require('./routes/screenerRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vaultRoutes = require('./routes/vaultRoutes');
const whaleRoutes = require('./routes/whaleRoutes');
const searchRoutes = require('./routes/searchRoutes');
const publicStatsRoutes = require('./routes/publicStats');
const postRoutes = require('./routes/postRoutes'); // ✅ NEW - Posts/Social Feed
const stripeRoutes = require('./routes/stripeRoutes'); // 💳 Stripe Payments

// ============================================
// STRIPE WEBHOOK - MUST BE BEFORE ANY BODY PARSING MIDDLEWARE
// ============================================
const User = require('./models/User');
const { PLAN_LIMITS } = require('./middleware/subscriptionMiddleware');

// Price mapping function for webhook
const getPlanFromPriceId = (priceId) => {
    const priceMapping = {
        [process.env.STRIPE_PRICE_STARTER]: 'starter',
        [process.env.STRIPE_PRICE_PRO]: 'pro',
        [process.env.STRIPE_PRICE_PREMIUM]: 'premium',
        [process.env.STRIPE_PRICE_ELITE]: 'elite'
    };
    const hardcodedMapping = {
        'price_1SV9d8CtdTItnGjydNZsbXl3': 'starter',
        'price_1SV9dTCtdTItnGjycfSxQtAg': 'pro',
        'price_1SV9doCtdTItnGjyYb8yG97j': 'premium',
        'price_1SV9eACtdTItnGjyzSNaNYhP': 'elite'
    };
    return priceMapping[priceId] || hardcodedMapping[priceId] || 'starter';
};

// Stripe webhook endpoint - raw body parser applied inline
app.post('/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
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
            console.log(`[Stripe Webhook] ✅ Signature verified! Event type: ${event.type}`);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        try {
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

                case 'invoice.payment_failed': {
                    const invoice = event.data.object;
                    const customerId = invoice.customer;
                    console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
                    // Could notify user or mark subscription as past_due
                    break;
                }

                default:
                    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
            }
        } catch (handlerError) {
            console.error(`[Stripe Webhook] Error handling event:`, handlerError);
            // Still return 200 so Stripe doesn't retry
        }

        res.json({ received: true });
    }
);

// --- Database Connection Setup ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // ✅ START ALERT CHECKER AFTER DB CONNECTION
        const { startAlertChecker } = require('./services/alertChecker');
        startAlertChecker();
        
        // ✅ START PREDICTION CHECKER - ENABLED!
        const { startPredictionChecker } = require('./services/predictionChecker');
        startPredictionChecker();
        
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
    }
};

// Connect to Database immediately when app loads
connectDB();

// --- CORS Setup ---
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3000/', // ✅ Added with trailing slash
    'http://localhost:5000/', // ✅ Added with trailing slash
    'https://www.nexussignal.ai',
    'https://nexussignal.ai',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        // Allow all localhost origins in development
        if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
            return callback(null, true);
        }
        
        // Check allowed origins list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS Blocked: ${origin}`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
}));
app.options('*', cors());

// --- Rate Limiting ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Middleware ---
app.use(helmet());

// --- JSON parsing ---
// Note: Stripe webhook is handled BEFORE this middleware in app.js
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboard');
const stockRoutes = require('./routes/stockRoutes');
const cryptoRoutes = require('./routes/cryptoRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const predictionsRoutes = require('./routes/predictionsRoutes');
const chatRoutes = require('./routes/chatRoutes');
const newsRoutes = require('./routes/newsRoutes');
const socialRoutes = require('./routes/socialRoutes');
const feedRoutes = require('./routes/feedRoutes');
const sentimentRoutes = require('./routes/sentimentRoutes');
const portfolioHistoryRoutes = require('./routes/portfolioHistoryRoutes');
const aiInsightsRoutes = require('./routes/aiInsightsRoutes')
const chartRoutes = require('./routes/chartRoutes');
const calculatorRoutes = require('./routes/calculatorRoutes'); 
const paperTradingRoutes = require('./routes/paperTradingRoutes');
const alertRoutes = require('./routes/alertRoutes'); // ✅ ADDED - Price Alerts System
const patternRoutes = require('./routes/patternRoutes'); // ✅ ADDED - AI Pattern Recognition
const statsRoutes = require('./routes/statsRoutes'); // ✅ ADDED - Platform Stats for Landing Page
const onboardingRoutes = require('./routes/onboardingRoutes'); // ✅ ADDED - Onboarding Flow
const leaderboardRoutes = require('./routes/leaderboardRoutes')
const walletRoutes = require('./routes/walletRoutes'); // Wallet Connection
const brokerageRoutes = require('./routes/brokerageRoutes'); // Brokerage Connections (Kraken, Plaid)
const twoFactorRoutes = require('./routes/twoFactorRoutes'); // Two-Factor Authentication

// Basic root route for health check
app.get('/', (req, res) => res.send('API is running...'));

// --- ROUTE MOUNTING (with /api prefix) ---
app.use('/api/auth', authRoutes);
app.use('/api/auth', onboardingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/portfolio', portfolioHistoryRoutes);
app.use('/api/portfolio', aiInsightsRoutes);
app.use('/api/chart', chartRoutes);
app.use('/api/calculators', calculatorRoutes); 
app.use('/api/paper-trading', paperTradingRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/gamification', onboardingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', statsRoutes);
app.use('/api/whale', whaleRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/public', publicStatsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/posts', postRoutes); // ✅ NEW - Posts/Social Feed
app.use('/api/wallet', walletRoutes); // Wallet Connection
app.use('/api/brokerage', brokerageRoutes); // Brokerage Connections (Kraken, Plaid)
app.use('/api/2fa', twoFactorRoutes); // Two-Factor Authentication
app.use('/api/stripe', stripeRoutes); // 💳 Stripe Payments & Subscriptions

// ============================================
// ROUTES WITHOUT /api PREFIX 
// (For frontend components that call without /api)
// ============================================
app.use('/vault', vaultRoutes);
app.use('/predictions', predictionsRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/heatmap', heatmapRoutes);
app.use('/screener', screenerRoutes);
app.use('/public', publicStatsRoutes);
app.use('/posts', postRoutes);

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Server Error'
    });
});

module.exports = app;