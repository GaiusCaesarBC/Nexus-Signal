// 1. Load dotenv *simply*. This works for local/Codespaces.
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); 

// 2. Log key status (will use Render's env vars on live)
console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- START AGGRESSIVE CORS FIX (Replace previous CORS block with this) ---
const allowedOrigins = [
  'https://nexus-signal.vercel.app', // Primary Frontend
  'http://localhost:3000',           // Local Development
  'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Codespace 3000
  'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev'  // Codespace 8081
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`[CORS REJECT] Origin ${origin} not in allowed list.`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", // Ensure OPTIONS is explicit
  credentials: true, 
  optionsSuccessStatus: 204
};

// 1. Pre-Route CORS Middleware (Handles OPTIONS preflights correctly)
app.use(cors(corsOptions));

// 2. Simple Catch-all OPTIONS Handler (Extra layer of defense against 404 for OPTIONS)
app.options('*', cors(corsOptions)); 

// --- END AGGRESSIVE CORS FIX ---


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
const PORT = process.env.PORT || 10000; // Using 10000 as per your logs
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));