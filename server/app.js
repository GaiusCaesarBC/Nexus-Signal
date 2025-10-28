  // server/app.js - CONSOLIDATED APP LOGIC
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const app = express();
const path = require('path'); // Add this line at the top with other imports
// ... rest of your imports

// Rate limiting to prevent abuse (Moved here from previous app.js, can also be in index.js)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per 15 minutes per IP
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Middleware - Order matters!
app.use(cors()); // Ensure CORS is first
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(limiter); // Apply rate limiting

// Import ALL Route Files
const authRoutes = require('./routes/auth'); // This is your actual auth logic, should be unique
const userRoutes = require('./routes/userRoutes'); // If this contains user registration/profile management separate from auth
const marketDataRoutes = require('./routes/marketDataRoutes'); // Or marketDataRoutes if that's the name in its file
const dashboardRoutes = require('./routes/dashboard');
const watchlistRoutes = require('./routes/watchlistRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes'); // <--- CRITICAL: ADD THIS IMPORT
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const predictionRoutes = require('./routes/predictionRoutes');


// Define ALL Routes
app.use('/api/auth', authRoutes); // Use the correct authRoutes from auth.js
app.use('/api/users', userRoutes); // Example, if userRoutes handles user-specific actions
app.use('/api/market-data', marketDataRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes); // <--- CRITICAL: ADD THIS APP.USE
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/predict', predictionRoutes);


// Global Error handling middleware - Placed after all routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).send(err.message || 'Something broke!');
});

module.exports = app; // Export the configured app instance