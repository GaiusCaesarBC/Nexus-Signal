require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Make sure cors is required

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// --- THIS IS THE FIX ---
// Enable CORS for all routes. This adds the necessary headers to your server's responses.
app.use(cors());
// ---------------------

// Define Routes
app.use('/api/predict', require('./routes/predictionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/watchlist', require('./routes/watchlistRoutes'));
app.use('/api/copilot', require('./routes/copilotRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/market-data', require('./routes/marketDataRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));