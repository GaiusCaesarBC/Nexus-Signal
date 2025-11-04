// server/index.js (FOR RENDER DEPLOYMENT)

// Load environment variables from .env file (for local development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = require('./app');
const connectDB = require('./config/db');
connectDB();

// Define the port to listen on - RENDER REQUIRES THIS
const PORT = process.env.PORT || 5000;

// Start the server and listen for incoming requests - RENDER REQUIRES THIS
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app; // Still export the app instance