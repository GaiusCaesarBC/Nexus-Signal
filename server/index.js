require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));
app.use(cors());

// Define Routes
app.use('/api/predict', require('./routes/predictionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/watchlist', require('./routes/watchlistRoutes'));
app.use('/api/copilot', require('./routes/copilotRoutes'));
app.use('/api/news', require('./routes/newsRoutes')); // <-- ADD THIS LINE

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Quantum Trade server running on port ${PORT}`));

