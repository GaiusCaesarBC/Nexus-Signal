require('dotenv').config({ path: require('path').resolve(__dirname, './.env') }); // Explicit path load first
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Keep require, but we'll manually set headers first

console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- VERY EARLY CORS HEADER MIDDLEWARE ---
// Apply this BEFORE anything else to try and catch the OPTIONS preflight
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nexus-signal.vercel.app',
    'http://localhost:3000',
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev' // Your Codespace FRONTEND URL
  ];

  console.log(`>>> Request Received: ${req.method} ${req.originalUrl} Origin: ${origin}`); // Log every request

  if (origin && allowedOrigins.includes(origin)) {
    console.log(`>>> Setting CORS header for origin: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    console.log(">>> Request has no origin header.");
    // Decide if you want to allow requests with no origin explicitly
    // res.setHeader('Access-Control-Allow-Origin', '*'); // Less secure
  } else {
    console.warn(`>>> Origin ${origin} not in allowedOrigins.`);
  }

  // Set other necessary CORS headers for preflight OPTIONS requests
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-auth-token,Authorization'); // Ensure x-auth-token is allowed
  res.setHeader('Access-Control-Allow-Credentials', true);

  // If this is an OPTIONS request, end the response here after setting headers
  if (req.method === 'OPTIONS') {
    console.log(`>>> Responding to OPTIONS preflight for ${req.originalUrl}`);
    return res.sendStatus(204); // OK, No Content
  }

  next(); // Pass control to the next middleware (like express.json, other cors, routes)
});
// --- END EARLY CORS HEADER MIDDLEWARE ---


// Connect Database
connectDB();

// Init Middleware (Body Parser)
app.use(express.json({ extended: false }));

// Optional: Apply standard CORS middleware as well (might be redundant now)
// app.use(cors(corsOptions)); // You can comment this out if the manual headers work

// --- Import and Define API Routes ---
console.log('[DEBUG index.js] Requiring route files...');
const predictionRoutes = require('./routes/predictionRoutes');
const userRoutes = require('./routes/userRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/predict', predictionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/payments', paymentRoutes);
// -----------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));

