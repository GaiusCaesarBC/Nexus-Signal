require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// --- THIS IS THE DEFINITIVE FIX ---
// We create a "VIP list" of all allowed origins.
const allowedOrigins = [
    'https://nexus-signal.vercel.app', // Your live Vercel frontend
    'http://localhost:3000'           // Your local development frontend
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests that are on the VIP list.
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

// Use the new, more flexible CORS options
app.use(cors(corsOptions));
// ------------------------------------

// Define Routes
app.use('/api/predict', require('./routes/predictionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/watchlist', require('./routes/watchlistRoutes'));
app.use('/api/copilot', require('./routes/copilotRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/market-data', require('./routes/marketDataRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));