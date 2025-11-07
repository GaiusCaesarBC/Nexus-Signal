// server/app.js - FINAL CORS FIX (Dynamic Origin)

const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const app = express();

// Whitelist of allowed frontend origins (CRITICAL)
const ALLOWED_ORIGINS = [
    'http://localhost:3000', // Local Development Frontend
    'http://localhost:5000', // Sometimes the frontend runs on the backend port during certain dev setups
    'https://www.nexussignal.ai', // Production Domain
    'https://nexussignal.ai',     // Production Domain (naked domain)
    'https://nexus-signal-backend.onrender.com', // Render's potential internal domain (less common but safe)
    // Add any other deployment URLs Vercel uses for preview branches here if needed
];

// === CORE MIDDLEWARE ===

// 1. CORS: Enable Dynamic Origin and Credentials
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or server-to-server)
        if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`CORS BLOCKED: Origin ${origin} not allowed by CORS.`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true, // CRITICAL: Required for sending/receiving HttpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight (OPTIONS) requests

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ... rest of middleware ...


// === ROUTE DEFINITIONS ===
const authRoutes = require('./routes/auth');
// ... other route imports ...

app.use('/api/auth', authRoutes);
// ... other route definitions ...


// === EXPORT THE APP ===
module.exports = app;