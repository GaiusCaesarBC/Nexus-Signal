// server/index.js - DEFINITIVE UPDATED VERSION FOR SUBSCRIBERS (Backend ONLY)
// This file is the main entry point for your backend server.

require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

// Import route files
const userRoutes = require('./routes/userRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes'); // Keep this as it's separate
const paymentRoutes = require('./routes/paymentRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const dashboardRoutes = require('./routes/dashboard'); // <--- ADD THIS LINE: IMPORT DASHBOARD ROUTES

console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] MONGO_URI loaded?: ${process.env.MONGO_URI ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] ALPHA_VANTAGE_API_KEY loaded?: ${process.env.ALPHA_VANTAGE_API_KEY ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] COINGECKO_API_KEY loaded?: ${process.env.COINGECKO_API_KEY ? 'Yes' : 'No'}`);


const app = express();

// --- START: CORRECT CORS CONFIGURATION (using npm 'cors' package) ---
const allowedOrigins = [
    'http://localhost:3000',
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev',
    'https://nexus-signal.vercel.app',
    'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev',
    'https://nexus-signal.onrender.com'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token'],
    credentials: true,
    optionsSuccessStatus: 204
}));
// --- END: CORRECT CORS CONFIGURATION ---


// Connect to MongoDB
connectDB();

// Body parser middleware - must be after CORS for preflight
app.use(express.json({ extended: false }));

console.log('[DEBUG index.js] Requiring route files...');
app.use('/api/predict', predictionRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/dashboard', dashboardRoutes); // <--- ADD THIS LINE: USE DASHBOARD ROUTES

// This is the fallback for development mode (when not in production)
app.get('/', (req, res) => {
    res.send('Nexus Signal AI Backend is running. Access frontend via Vercel URL.');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));