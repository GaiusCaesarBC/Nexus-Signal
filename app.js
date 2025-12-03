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