// 1. Load dotenv *simply*. This works for local/Codespaces.
// On Render, this will be skipped, and Render's env vars will be used.
require('dotenv').config(); 
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Required for the fix

// 2. Log key status (will use Render's env vars on live)
console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- START Recommended CORS Fix (using the standard 'cors' package) ---
// Define the allowed origin(s) for your frontend
const allowedOrigins = [
  'https://nexus-signal.vercel.app', // Vercel Frontend (The fix is primarily here)
  'http://localhost:3000',           // Your local development frontend (standard)
  'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Codespace Frontend
  'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev'  // Codespace Frontend (Port 8081)
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    // or if the origin is in our allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log the rejected origin for debugging on Render logs
      console.error(`CORS Reject: Origin ${origin} not in allowed list.`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Important if you use cookies or auth tokens
  optionsSuccessStatus: 204 // For preflight requests
};

app.use(cors(corsOptions)); // Use the 'cors' middleware with your options
// --- END Recommended CORS Fix ---


// 4. Connect DB and add other middleware.
connectDB();
app.use(express.json({ extended: false }));

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