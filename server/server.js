// server/server.js - CRITICAL REVISION for CORS Handling

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors'); // Keep cors package for potential fallback/robustness

// Load environment variables from .env file
dotenv.config();

const app = express();

// === AGGRESSIVE CORS DEBUGGING MIDDLEWARE - MUST BE AT THE VERY TOP ===
// This custom middleware explicitly forces CORS headers on all responses
// and specifically handles preflight (OPTIONS) requests.
app.use((req, res, next) => {
    // IMPORTANT: Replace these with your EXACT, CURRENT Codespace URLs.
    // You can find these in your browser address bar or Codespaces "PORTS" tab.
    const frontendOrigin = 'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev'; // <--- VERIFY THIS
    const backendOrigin = 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev';  // <--- VERIFY THIS
    
    const requestOrigin = req.headers.origin;

    // Set Access-Control-Allow-Origin
    if (requestOrigin === frontendOrigin || requestOrigin === backendOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else if (!requestOrigin) { // Allow direct access without origin (e.g., Postman, curl)
        res.setHeader('Access-Control-Allow-Origin', '*'); 
    } else { // For any other origin, for debugging purposes allow all
        res.setHeader('Access-Control-Allow-Origin', '*'); 
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token'); // Crucially include x-auth-token
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // Required for cookies/auth headers

    // Handle preflight requests (OPTIONS method)
    if (req.method === 'OPTIONS') {
        console.log('--- Custom CORS Middleware: Handling OPTIONS Preflight ---');
        console.log('Request Origin:', requestOrigin);
        console.log('Allowed Origin Set:', res.getHeader('Access-Control-Allow-Origin'));
        console.log('Allowed Methods Set:', res.getHeader('Access-Control-Allow-Methods'));
        console.log('Allowed Headers Set:', res.getHeader('Access-Control-Allow-Headers'));
        return res.sendStatus(204); // Send 204 No Content for successful preflight
    }
    
    // For actual requests (GET, POST, etc.), just log and proceed
    console.log(`--- Custom CORS Middleware: Processing ${req.method} request from ${requestOrigin} ---`);
    next(); // Pass control to the next middleware/route handler
});
// === END AGGRESSIVE CORS DEBUGGING ===

// Body parser must come AFTER custom CORS middleware if it's handling OPTIONS
app.use(express.json()); 

// You can keep the 'cors' package middleware, but ensure it's configured
// to allow your origins, even if our custom one is doing the heavy lifting.
// It should typically come AFTER the custom one or replace it if fully configured.
// For now, let's keep it in case it's needed, but ensure our custom one runs first.
app.use(cors({
    origin: [
        'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // <--- VERIFY THIS
        'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev'  // <--- VERIFY THIS
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204, // This ensures the npm 'cors' package also responds with 204 for OPTIONS
}));


// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

connectDB();

// Basic route for testing server
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Define Auth Routes
app.use('/api/auth', require('./routes/auth')); 

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));