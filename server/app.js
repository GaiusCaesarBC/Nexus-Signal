// server/app.js - CONSOLIDATED APP LOGIC (REFINED)

const express = require('express');
const cors = require('cors'); // Handles Cross-Origin Resource Sharing
const helmet = require('helmet'); // Helps secure your app by setting various HTTP headers
const mongoSanitize = require('express-mongo-sanitize'); // Sanitizes user-supplied data to prevent MongoDB Operator Injection
const xss = require('xss-clean'); // Sanitizes user input to prevent Cross-site Scripting (XSS) attacks
const hpp = require('hpp'); // Protects against HTTP Parameter Pollution attacks
const rateLimit = require('express-rate-limit'); // Limits repeated requests to public APIs and/or endpoints - Corrected package name
const app = express();

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
    max: 100, // Max 100 requests per window per IP
    message: 'Too many requests from this IP, please try again after 15 minutes',
});


// === CORE MIDDLEWARE ===
const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false })); // ADDED: You usually need this for form data
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
// app.use(limiter);


// === ROUTE IMPORTS ===
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const dashboardRoutes = require('./routes/dashboard');
const watchlistRoutes = require('./routes/watchlistRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const stockRoutes = require('./routes/stockRoutes');
const cryptoRoutes = require('./routes/cryptoRoutes'); // <--- CRITICAL: ENSURE THIS IS PRESENT


// NEW: Debugging middleware to see every request - Keep this for now!
app.use((req, res, next) => {
    console.log(`[APP.JS DEBUG] Incoming Request: ${req.method} ${req.url}`);
    next();
});

// === ROUTE DEFINITIONS ===
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/predict', predictionRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/crypto', cryptoRoutes); // <--- CRITICAL: ENSURE THIS IS PRESENT AND CORRECT


// === GLOBAL ERROR HANDLING MIDDLEWARE ===
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).send(err.message || 'Something broke!');
});


// === EXPORT THE APP ===
module.exports = app;