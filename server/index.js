// server/index.js

// Load environment variables from .env file (for local development)
// Render handles these as service environment variables in production.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: './config/config.env' });
}

// Import the Express app instance configured in app.js
const app = require('./app');

// Import and connect to the database
const connectDB = require('./config/db'); // Assuming this path is correct for your DB connection
connectDB();

// Define the port to listen on
// Use the PORT environment variable provided by Render in production,
// or fallback to 5000 for local development.
const PORT = process.env.PORT || 5000;

// Start the server and listen for incoming requests
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});