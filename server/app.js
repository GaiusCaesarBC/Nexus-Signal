require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express(); // This is your Express app instance

// Import your route files (ensure these paths are correct as per our last discussion)
const authRoutes = require('./routes/auth');        // Confirmed 'auth.js'
const stockRoutes = require('./routes/stockRoutes'); // Corrected to 'stockRoutes.js'
const cryptoRoutes = require('./routes/cryptoRoutes'); // Assuming 'cryptoRoutes.js'
const authMiddleware = require('./middleware/authMiddleware');

// --- Middleware Setup ---
const allowedOrigins = [
    'https://www.nexussignal.ai',
    'http://localhost:3000',
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
}));
app.use(express.json());
app.use(cookieParser());

// 4. Basic Root Route (Optional - just to confirm server is running)
app.get('/', (req, res) => {
    res.send('Nexus Signal API is running!');
});

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/stocks', authMiddleware, stockRoutes); // Use authMiddleware for stock routes
app.use('/api/crypto', authMiddleware, cryptoRoutes); // Use authMiddleware for crypto routes


// --- Error Handling Middleware (Optional but Recommended for clean error messages) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke on the server!');
});

// --- CRITICAL CHANGE: EXPORT THE APP INSTANCE ---
module.exports = app;

