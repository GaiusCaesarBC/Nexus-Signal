require('dotenv').config({ path: require('path').resolve(__dirname, './.env') }); // Explicit path load first
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Keep require

console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- VERY EARLY CORS HEADER MIDDLEWARE ---
// Apply this BEFORE anything else
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // --- ENSURE YOUR VERCEL URL IS LISTED HERE ---
  const allowedOrigins = [
    'https://nexus-signal.vercel.app', // <<<=== MAKE SURE THIS LINE EXISTS AND IS CORRECT
    'http://localhost:3000',           // Your local development frontend (standard)
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Your Codespace FRONTEND URL (Port 3000)
    'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev' // Your Codespace FRONTEND URL if backend is on 8081
    // Add any other specific origins if needed
  ];
  // ------------------------------------------

  console.log(`>>> Request Received: ${req.method} ${req.originalUrl} Origin: ${origin}`); // Log every request

  if (origin && allowedOrigins.includes(origin)) {
    console.log(`>>> Setting CORS header for origin: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    console.log(">>> Request has no origin header.");
    // Allow requests with no origin? Often needed for server-to-server or tools like Postman
    // res.setHeader('Access-Control-Allow-Origin', '*'); // Less secure, use specific origins if possible
  } else {
    console.warn(`>>> Origin ${origin} not in allowedOrigins.`);
  }

  // Set other necessary CORS headers for preflight OPTIONS requests
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // Make sure 'x-auth-token' is included here if your AuthContext sends it
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-auth-token,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);

  // If this is an OPTIONS request, end the response here after setting headers
  if (req.method === 'OPTIONS') {
    console.log(`>>> Responding to OPTIONS preflight for ${req.originalUrl}`);
    return res.sendStatus(204); // OK, No Content
  }

  next(); // Pass control to the next middleware
});
// --- END EARLY CORS HEADER MIDDLEWARE ---


// Connect Database
connectDB();

// Init Middleware (Body Parser)
app.use(express.json({ extended: false }));

// --- Import and Define API Routes ---
// (Ensure these require statements are correct based on your file structure)
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

// Define the Port (Using 8081, ensure Render is configured for this port)
const PORT = process.env.PORT || 8081;

// Start the Server
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));

