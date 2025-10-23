// 1. Load dotenv *first* and give it the explicit path.
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// 2. Log the result of the dotenv load immediately.
if (dotenvResult.error) {
  console.error('[DEBUG index.js] Error loading .env file:', dotenvResult.error);
} else {
  console.log('[DEBUG index.js] dotenv.config() successful.');
  // Check for the key here to confirm it's loaded
  console.log(`[DEBUG index.js] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);
}

// 3. Now, require all other modules *after* dotenv has run.
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const app = express();

// 4. Add the CORS middleware (the manual one we built).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nexus-signal.vercel.app', // <<<--- THIS IS THE FIX FOR THE LIVE SITE
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

// 5. Connect DB and add other middleware.
connectDB();
app.use(express.json({ extended: false }));

// 6. Require and use routes.
console.log('[DEBUG index.js] Requiring route files...');
app.use('/api/predict', require('./routes/predictionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/watchlist', require('./routes/watchlistRoutes'));
app.use('/api/copilot', require('./routes/copilotRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/market-data', require('./routes/marketDataRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/waitlist', require('./routes/waitlistRoutes')); // <-- THIS IS THE FIX FOR THE ROUTE

// 7. Set port and listen.
const PORT = process.env.PORT || 8081; // Using 8081 as it worked in Codespaces
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));

