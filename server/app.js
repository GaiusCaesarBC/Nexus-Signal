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
// Order matters! Middleware is executed in the order it's defined.

// 1. CORS: Enable All CORS Requests (should be first for preflight requests)
// This will correctly handle the OPTIONS request from your frontend.
app.use(cors());

// 2. Helmet: Set security-related HTTP headers
app.use(helmet());

// 3. Body Parser: Parse JSON bodies (limit prevents large payloads)
app.use(express.json({ limit: '10kb' }));

// 4. Data Sanitization: Prevent NoSQL query injection
app.use(mongoSanitize());

// 5. Data Sanitization: Prevent XSS attacks
app.use(xss());

// 6. Prevent Parameter Pollution:
app.use(hpp());

// 7. Apply Rate Limiting (uncomment when ready, placed after other security middleware)
// app.use(limiter);


// === ROUTE IMPORTS ===
// Import all your route files. Ensure these paths are correct relative to app.js.
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
const predictionRoutes = require('./routes/predictionRoutes'); // Assuming this will handle /api/predict
const stockRoutes = require('./routes/stockRoutes');           // Assuming this will handle /api/stocks/historical


// NEW: Debugging middleware to see every request - Keep this for now!
app.use((req, res, next) => {
    console.log(`[APP.JS DEBUG] Incoming Request: ${req.method} ${req.url}`);
    next();
});

// === ROUTE DEFINITIONS ===
// Define the base paths for your API routes.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/market-data', marketDataRoutes); // Corrected to use imported variable
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/predict', predictionRoutes); // Mount for prediction specific logic
app.use('/api/stocks', stockRoutes);     // Mount for general stock data, e.g. historical data


// === GLOBAL ERROR HANDLING MIDDLEWARE ===
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(err.statusCode || 500).send(err.message || 'Something broke!'); // Send a generic error response
});


// === EXPORT THE APP ===
module.exports = app;