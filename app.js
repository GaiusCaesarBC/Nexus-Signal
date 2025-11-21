// server/app.js - Updated with Portfolio, Predictions, and Chat Routes

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
const app = express();
const journalRoutes = require('./routes/journalRoutes');
const screenerRoutes = require('./routes/screenerRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');


// --- Database Connection Setup ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
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
    'https://www.nexussignal.ai',
    'https://nexussignal.ai',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
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

// --- Middleware ---
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

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
const chatRoutes = require('./routes/chatRoutes'); // ✅ ADDED
const newsRoutes = require('./routes/newsRoutes');
const socialRoutes = require('./routes/socialRoutes');
const feedRoutes = require('./routes/feedRoutes');

// Basic root route for health check
app.get('/', (req, res) => res.send('API is running...'));

// --- ROUTE MOUNTING ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/chat', chatRoutes); // ✅ ADDED
app.use('/api/journal', journalRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/feed', feedRoutes);

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Server Error'
    });
});

module.exports = app;