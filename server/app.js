// server/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const marketDataRoutes = require('./routes/marketData');
const dashboardRoutes = require('./routes/dashboard'); // <--- ADD THIS LINE

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per 15 minutes per IP
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Middleware
app.use(cors());
app.use(helmet()); // Set security headers
app.use(express.json({ limit: '10kb' })); // Body parser, reading data into req.body
app.use(mongoSanitize()); // Data sanitization against NoSQL query injection
app.use(xss()); // Data sanitization against XSS attacks
app.use(hpp()); // Prevent parameter pollution
app.use(limiter); // Apply rate limiting to all requests

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/dashboard', dashboardRoutes); // <--- ADD THIS LINE

// Basic route for testing
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error handling middleware (optional, but good practice for centralized error handling)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).send(err.message || 'Something broke!');
});

module.exports = app;