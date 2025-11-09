require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose'); // Import Mongoose
const app = express(); // This is your Express app instance

// --- Database Connection ---
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('CRITICAL ERROR: MONGODB_URI is not defined in environment variables.');
            // Exit the process if the DB URI is missing, as the app won't function
            process.exit(1);
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // These options are often recommended for Mongoose 6+ but may vary by version
            // Depending on your Mongoose version, some might be deprecated or default true.
            // Check Mongoose docs for your specific Mongoose version.
            // useNewUrlParser: true,     // Often deprecated/default true in Mongoose 6+
            // useUnifiedTopology: true,  // Often deprecated/default true in Mongoose 6+
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000,       // Close sockets after 45 seconds of inactivity
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Exit process on connection failure
        process.exit(1);
    }
};

// Call connectDB to establish connection when the app starts
connectDB();

// Import your route files (ensure these paths are correct as per our last discussion)
const authRoutes = require('./routes/auth');        // Confirmed 'auth.js'
const stockRoutes = require('./routes/stockRoutes'); // Confirmed 'stockRoutes.js'
const cryptoRoutes = require('./routes/cryptoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authMiddleware = require('./middleware/authMiddleware'); // Confirmed

// --- Middleware Setup ---
const allowedOrigins = [
    'https://www.nexussignal.ai',
    'http://localhost:3000',
    // Add any other specific Vercel deployment URLs if you have them, e.g.:
    // 'https://nexus-signal-lgou13znm-cody-watkins-projects.vercel.app'
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
            console.warn(`CORS BLOCKED: Origin ${origin} not allowed by CORS.`); // Log the blocked origin
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

// Basic Root Route (Optional - just to confirm server is running)
app.get('/', (req, res) => {
    res.send('Nexus Signal API is running!');
});

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/stocks', authMiddleware, stockRoutes); // Use authMiddleware for stock routes
app.use('/api/crypto', authMiddleware, cryptoRoutes); // Use authMiddleware for crypto routes
app.use('/api/dashboard', authMiddleware, dashboardRoutes);

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(`Unhandled Server Error: ${err.message}`, err.stack); // More detailed logging
    res.status(500).send('Something broke on the server!');
});

// --- CRITICAL: EXPORT THE APP INSTANCE for index.js to listen ---
module.exports = app;