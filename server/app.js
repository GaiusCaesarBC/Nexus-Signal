// server/app.js - CONSOLIDATED APP LOGIC

// REMOVE THIS LINE:
// const path = require('path'); // Core Node.js module for working with file paths

const express = require('express');
const cors = require('cors'); // Handles Cross-Origin Resource Sharing
const helmet = require('helmet'); // Helps secure your app by setting various HTTP headers
const mongoSanitize = require('express-mongo-sanitize'); // Sanitizes user-supplied data to prevent MongoDB Operator Injection
const xss = require('xss-clean'); // Sanitizes user input to prevent Cross-site Scripting (XSS) attacks
const hpp = require('hpp'); // Protects against HTTP Parameter Pollution attacks
const rateLimit = require('express-rate-limit'); // Limits repeated requests to public APIs and/or endpoints
const app = express();

// Load environment variables (if not already done in index.js)
// If you have a separate index.js that does dotenv.config(), you can remove this.
// require('dotenv').config({ path: './config/config.env' });


// Rate limiting to prevent abuse
// This limits each IP to 100 requests per 15 minutes.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
    max: 100, // Max 100 requests
    message: 'Too many requests from this IP, please try again after 15 minutes',
});


// === CORE MIDDLEWARE ===
// Order matters! Middleware is executed in the order it's defined.

// 1. CORS: Enable All CORS Requests
// Allows your frontend to make requests to your backend, even if on different domains/ports (especially during development).
app.use(cors());

// 2. Helmet: Set security-related HTTP headers
// Helps protect against various web vulnerabilities.
app.use(helmet());

// 3. Body Parser: Parse JSON bodies
// Allows Express to read JSON data sent in the body of requests.
// 'limit: 10kb' prevents large payloads, improving security.
app.use(express.json({ limit: '10kb' }));

// 4. Data Sanitization: Prevent NoSQL query injection
// Cleans user-supplied data from MongoDB operator injection.
app.use(mongoSanitize());

// 5. Data Sanitization: Prevent XSS attacks
// Cleans user-supplied HTML from malicious script tags.
app.use(xss());

// 6. Prevent Parameter Pollution:
// Protects against malicious users who might try to pollute request parameters.
app.use(hpp());

// 7. Apply Rate Limiting:
// Applies the defined rate limiter to all incoming requests.
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
const predictionRoutes = require('./routes/predictionRoutes');
const stockRoutes = require('./routes/stockRoutes'); // <-- ADD THIS LINE for your new stock routes

// NEW: Debugging middleware to see every request
app.use((req, res, next) => {
    console.log(`[APP.JS DEBUG] Incoming Request: ${req.method} ${req.url}`);
    next();
});

app.use('/api/stocks', stockRoutes); // Your existing line
// ...

// === ROUTE DEFINITIONS ===
// Define the base paths for your API routes.
// Requests starting with these paths will be handled by the imported router.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/market-data', require('./routes/marketDataRoutes'));
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/predict', predictionRoutes);
app.use('/api/stocks', stockRoutes); // <-- ADD THIS LINE to mount your new stock routes


// === GLOBAL ERROR HANDLING MIDDLEWARE ===
// This middleware catches any errors that occur in your routes or other middleware.
// It should be placed last.
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(err.statusCode || 500).send(err.message || 'Something broke!'); // Send a generic error response
});


// === EXPORT THE APP ===
// The configured Express app instance is exported to be used by your main server entry file (e.g., index.js).
module.exports = app;