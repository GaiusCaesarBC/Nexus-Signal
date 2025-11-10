// server/app.js - FINAL VERSION WITH DB CONNECTION

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose'); // <--- CRITICAL NEW IMPORT
const app = express();

// --- Database Connection Setup ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Don't exit process here in dev, might want to retry, but for now log it loudly.
        // In production, Render will restart it if it crashes.
    }
};

// Connect to Database immediately when app loads
connectDB();

// --- CORS Setup ---
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://www.nexussignal.ai',
    'https://nexussignal.ai',
    // Add any other Vercel preview URLs if you need them later
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS Blocked: ${origin}`);
            // Optionally allow it anyway for debugging if you are desperate, but better to block unexpected origins.
            // For now, let's stick to the whitelist to be secure.
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
}));
app.options('*', cors()); // Handle preflight requests for all routes

// --- Middleware ---
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
// const marketDataRoutes = require('./routes/marketDataRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
// const watchlistRoutes = require('./routes/watchlistRoutes');
// const portfolioRoutes = require('./routes/portfolioRoutes');
const stockRoutes = require('./routes/stockRoutes');
const cryptoRoutes = require('./routes/cryptoRoutes');

// Basic root route for health check
app.get('/', (req, res) => res.send('API is running...'));

// --- ROUTE MOUNTING ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/market-data', marketDataRoutes);
app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/watchlist', watchlistRoutes);
// app.use('/api/portfolio', portfolioRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/crypto', cryptoRoutes);

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Server Error'
    });
});

module.exports = app;