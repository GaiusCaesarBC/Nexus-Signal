// server/app.js - CONSOLIDATED APP LOGIC (REFINED for HttpOnly Cookies)

const express = require('express');
const cors = require('cors'); // Handles Cross-Origin Resource Sharing
const helmet = require('helmet'); // Helps secure your app by setting various HTTP headers
const mongoSanitize = require('express-mongo-sanitize'); // Sanitizes user-supplied data to prevent MongoDB Operator Injection
const xss = require('xss-clean'); // Sanitizes user input to prevent Cross-site Scripting (XSS) attacks
const hpp = require('hpp'); // Protects against HTTP Parameter Pollution attacks
const rateLimit = require('express-rate-limit'); // Limits repeated requests to public APIs and/or endpoints
const cookieParser = require('cookie-parser'); // <<< NEW: For parsing HttpOnly cookies

const app = express();

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
    max: 100, // Max 100 requests per window per IP
    message: 'Too many requests from this IP, please try again after 15 minutes',
});


const corsOptions = {
    origin: 'http://localhost:3000', // <<< CHANGE THIS TEMPORARILY FOR LOCAL DEV
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight (OPTIONS) requests which are common for CORS

app.use(helmet()); // Basic security headers
app.use(express.json({ limit: '10kb' })); // Body parser for JSON data, with a size limit
app.use(express.urlencoded({ extended: false })); // Body parser for URL-encoded data (e.g., form submissions)

// IMPORTANT: `cookieParser()` must be used before any routes that need to access `req.cookies`
app.use(cookieParser()); // <<< NEW: Enable cookie parsing

app.use(mongoSanitize()); // Prevent MongoDB injection attacks
app.use(xss()); // Prevent Cross-Site Scripting (XSS) attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution attacks
// app.use(limiter); // Uncomment to enable rate limiting when ready


// === ROUTE IMPORTS ===
// (Ensure these paths are correct relative to your server/ directory)
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
const cryptoRoutes = require('./routes/cryptoRoutes');


// === ROUTE DEFINITIONS ===
// (These map your API endpoints to their respective route files)
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
app.use('/api/crypto', cryptoRoutes);


// === GLOBAL ERROR HANDLING MIDDLEWARE ===
// This catches any errors that occur in your routes or middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the full error stack to the console (important for debugging)
    res.status(err.statusCode || 500).send(err.message || 'Something broke!'); // Send a generic error response
});


// === EXPORT THE APP ===
module.exports = app;