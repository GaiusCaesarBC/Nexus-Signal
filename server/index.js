require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

// server/index.js

// ... other imports

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// --- START CHANGE ---
// Add your frontend Codespace URL to the allowed list
const allowedOrigins = [
    'https://nexus-signal.vercel.app', // Your live Vercel frontend
    'http://localhost:3000',           // Your local development frontend
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev' // <-- ADD THIS LINE
];
// --- END CHANGE ---

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests) OR matching allowed origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`CORS blocked origin: ${origin}`); // Log blocked origins
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Define Routes
// ... rest of the file

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

app.listen(PORT, () => {
  console.log(`Nexus Signal AI server running on port ${PORT}`);
}); // <-- Add this closing brace