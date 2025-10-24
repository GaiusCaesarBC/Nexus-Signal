// 1. Load dotenv *simply*. This works for local/Codespaces.
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
// const cors = require('cors'); // Temporarily comment out cors package import for this test

// 2. Log key status (will use Render's env vars on live)
console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- START EXTREMELY AGGRESSIVE & DIRECT OPTIONS HANDLER ---
// Define allowed origins explicitly for manual handling
const allowedOrigins = [
  'https://nexus-signal.vercel.app', // Primary Frontend
  'http://localhost:3000',           // Local Development
  'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Codespace 3000
  'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev',  // Codespace 8081
  'https://nexus-signal.onrender.com' // <--- YOUR CORRECT BACKEND URL ADDED HERE
];

// This MUST be before any other app.use() or route definitions
app.options('*', (req, res, next) => {
  const origin = req.headers.origin;

  console.log(`[OPTIONS DEBUG] Received OPTIONS request for ${req.originalUrl} from Origin: ${origin}`);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log(`[OPTIONS DEBUG] Setting ACAO for: ${origin}`);
  } else {
    // If origin is not allowed or missing, still set ACAO for the primary (Vercel) origin
    // This is a failsafe to try and pass the preflight for your main Vercel app
    // In a real scenario, you'd likely want to return a 403 Forbidden here
    res.setHeader('Access-Control-Allow-Origin', 'https://nexus-signal.vercel.app');
    console.warn(`[OPTIONS DEBUG] Origin ${origin} not in allowed list. Defaulting ACAO to Vercel.`);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
  res.setHeader('Access-Control-Allow-Credentials', true);

  console.log(`[OPTIONS DEBUG] Responding to OPTIONS preflight for ${req.originalUrl} with 204.`);
  return res.sendStatus(204); // End the request here with 204 No Content
});

// For non-OPTIONS requests, we'll use a general CORS middleware (can use cors package or manual)
// Let's use a manual one for now to keep it consistent and log
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback for non-OPTIONS if origin is not explicitly allowed
        res.setHeader('Access-Control-Allow-Origin', 'https://nexus-signal.vercel.app');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
// --- END EXTREMELY AGGRESSIVE & DIRECT OPTIONS HANDLER ---


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
app.use('/api/waitlist', require('./routes/waitlistRoutes'));

// --- START: Simple message for the root URL ---
app.get('/', (req, res) => {
  res.send('Nexus Signal AI Backend is running!');
});
// --- END: Simple message for the root URL ---

// 6. Set port and listen.
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));