// 1. Load dotenv *simply*. This works for local/Codespaces.
// On Render, this will be skipped, and Render's env vars will be used.
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Ensure this is present and the 'cors' package is installed!

// 2. Log key status (will use Render's env vars on live)
console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- START SIMPLIFIED CORS Fix (full file provided below) ---
// Define the allowed origin(s) for your frontend
const allowedOrigins = [
  'https://nexus-signal.vercel.app', // Vercel Frontend (Ensure this is exact)
  'http://localhost:3000',           // Your local development frontend (standard)
  // Add any other specific development origins if needed
  'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Codespace Frontend
  'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev'  // Codespace Frontend (Port 8081)
];

// Use the 'cors' middleware BEFORE any routes are defined.
// This simplified setup explicitly checks the origin.
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS Reject: Origin ${origin} not in allowed list.`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Explicitly list methods
  credentials: true, // Only if your frontend sends cookies or authorization headers
  optionsSuccessStatus: 204 // Good for preflight
}));
// --- END SIMPLIFIED CORS Fix ---


// 4. Connect DB and add other middleware.
connectDB();
app.use(express.json({ extended: false })); // This should come AFTER CORS middleware

// 5. Require and use routes.
console.log('[DEBUG index.js] Requiring route files...');
app.use('/api/predict', require('./routes/predictionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/watchlist', require('./routes/watchlistRoutes'));
app.use('/api/copilot', require('./routes/copilotRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/market-data', require('./routes/marketDataRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/waitlist', require('./routes/waitlistRoutes')); // <-- Includes waitlist

// 6. Set port and listen.
// Render provides its own PORT env var, which this will use.
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));