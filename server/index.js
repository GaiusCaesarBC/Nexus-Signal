// server/index.js

// Load environment variables from .env file (for local development)
// Vercel handles these as project environment variables in production.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Import the Express app instance configured in app.js
const app = require('./app');

// Import and connect to the database
const connectDB = require('./config/db');
connectDB(); // Connect to DB when the serverless function is initialized

// -------------------------------------------------------------------
// IMPORTANT: REMOVE app.listen() FOR VERCEL SERVERLESS FUNCTIONS
// Vercel handles the HTTP server and listening itself.
// You only need to export the Express app instance.
// -------------------------------------------------------------------
// const PORT = process.env.PORT || 5000; // This line is no longer needed
// app.listen(PORT, () => { // This entire block must be removed
//     console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
// });
// -------------------------------------------------------------------

// Export the Express app instance for Vercel to use as a serverless function
module.exports = app;