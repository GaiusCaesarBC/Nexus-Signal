// 1. Load dotenv *simply*. This works for local/Codespaces.
// On Render, this will be skipped, and Render's env vars will be used.
require('dotenv').config(); 
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Keep require

// 2. Log key status (will use Render's env vars on live)
console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// 3. Add the CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nexus-signal.vercel.app', // Vercel Frontend
    'http://localhost:3000',           // Your local development frontend (standard)
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Codespace Frontend
    'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev'  // Codespace Frontend (Port 8081)
  ];

  console.log(`>>> Request Received: ${req.method} ${req.originalUrl} Origin: ${origin}`); // Log every request

  if (origin && allowedOrigins.includes(origin)) {
    console.log(`>>> Setting CORS header for origin: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    console.log(">>> Request has no origin header.");
  } else {
    console.warn(`>>> Origin ${origin} not in allowedOrigins.`);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-auth-token,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    console.log(`>>> Responding to OPTIONS preflight for ${req.originalUrl}`);
    return res.sendStatus(204); // OK, No Content
  }

  next();
});

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

