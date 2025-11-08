// server/app.js - Full Backend Configuration

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const app = express();

// Whitelist of allowed frontend origins (CRITICAL for CORS)
const ALLOWED_ORIGINS = [
    'http://localhost:3000',      // Local Development Frontend
    'http://localhost:5000',      // Sometimes backend serves frontend on this port
    'https://www.nexussignal.ai', // Production Domain (with www)
    'https://nexussignal.ai',     // Production Domain (naked domain)
    // Add any Vercel preview branch URLs if needed for testing (e.g., 'https://your-project-git-branch-vercel.app')
];

// === CORE MIDDLEWARE ===

// 1. CORS: Enable Dynamic Origin and Credentials
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        // Or if the origin is in our allowed list
        if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`CORS BLOCKED: Origin ${origin} not allowed by CORS.`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true, // CRITICAL: Required for sending/receiving HttpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'], // Allowed headers
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight (OPTIONS) requests for all routes

app.use(helmet()); // Set security headers
app.use(express.json({ limit: '10kb' })); // Body parser, reading data into req.body, limit to 10kb
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies from incoming requests

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
    whitelist: [ // Define parameters that can be duplicated if needed
        'duration', 'difficulty' // Example
    ]
}));

// Rate limiting to prevent brute-force attacks and abuse
const limiter = rateLimit({
    max: 100, // Max 100 requests per 15 minutes
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many requests from this IP, please try again after 15 minutes!'
});
app.use('/api', limiter); // Apply to all API routes

// === ROUTE DEFINITIONS ===
const authRoutes = require('./routes/auth');
const cryptoRoutes = require('./routes/cryptoRoutes');     // Assuming client/src/pages/PredictPage.js uses this
const stockRoutes = require('./routes/stockRoutes');      // If you have stock data routes
const dashboardRoutes = require('./routes/dashboard'); // Assuming client/src/pages/DashboardPage.js uses this
const predictionRoutes = require('./routes/predictionRoutes'); // If you have specific prediction routes

// Mount the routes
app.use('/api/auth', authRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/prediction', predictionRoutes);

// Catch-all for undefined routes
app.all('*', (req, res, next) => {
    res.status(404).json({
        status: 'fail',
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// === EXPORT THE APP ===
module.exports = app;