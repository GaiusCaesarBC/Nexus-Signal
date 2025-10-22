require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

// --- Import Route Files ---
const predictionRoutes = require('./routes/predictionRoutes');
const userRoutes = require('./routes/userRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const paymentRoutes = require('./routes/paymentRoutes'); // <-- Added payment routes

const app = express();

// --- ADDED DEBUG MIDDLEWARE ---
// Logs incoming requests before other processing
app.use((req, res, next) => {
  console.log(`>>> Request Received: ${req.method} ${req.originalUrl} Origin: ${req.headers.origin}`);
  next();
});
// --- END DEBUG MIDDLEWARE ---


// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false })); // Body parser for JSON

// --- CORS Configuration ---
const allowedOrigins = [
    'https://nexus-signal.vercel.app', // Your live Vercel frontend
    'http://localhost:3000',           // Your local development frontend (standard)
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev' // Your Codespace FRONTEND URL
];

const corsOptions = {
    origin: function (origin, callback) {
        console.log(`[CORS Check] Received Origin: ${origin}`); // Debug log

        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            console.log(`[CORS Check] Allowing origin: ${origin}`); // Debug log
            callback(null, true);
        } else {
            console.error(`[CORS Check] Blocking origin: ${origin}`); // Debug log
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); // Apply CORS options

// --- Define API Routes ---
app.use('/api/predict', predictionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/payments', paymentRoutes); // <-- Use payment routes

// --- Define the Port ---
const PORT = process.env.PORT || 5000;

// --- Start the Server ---
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));
