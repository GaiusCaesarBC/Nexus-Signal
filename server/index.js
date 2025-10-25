// server/index.js - DEFINITIVE UPDATED VERSION FOR SUBSCRIBERS
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes'); // <--- CORRECT: Imports subscriberRoutes
const predictionRoutes = require('./routes/predictionRoutes');

console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] MONGO_URI loaded?: ${process.env.MONGO_URI ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] ALPHA_VANTAGE_API_KEY loaded?: ${process.env.ALPHA_VANTAGE_API_KEY ? 'Yes' : 'No'}`);
console.log(`[DEBUG index.js Start] COINGECKO_API_KEY loaded?: ${process.env.COINGECKO_API_KEY ? 'Yes' : 'No'}`);

const app = express();

const allowedOrigins = [
    'https://nexus-signal.vercel.app',
    'http://localhost:3000',
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev',
    'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev',
    'https://nexus-signal.onrender.com'
];

app.options('*', (req, res, next) => {
    const origin = req.headers.origin;
    console.log(`[OPTIONS DEBUG] Received OPTIONS request for ${req.originalUrl} from Origin: ${origin}`);
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        console.log(`[OPTIONS DEBUG] Setting ACAO for: ${origin}`);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://nexus-signal.vercel.app');
        console.warn(`[OPTIONS DEBUG] Origin ${origin} not in allowed list. Defaulting ACAO to Vercel.`);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
    res.setHeader('Access-Control-Allow-Credentials', true);
    console.log(`[OPTIONS DEBUG] Responding to OPTIONS preflight for ${req.originalUrl} with 204.`);
    return res.sendStatus(204);
});

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://nexus-signal.vercel.app');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

connectDB();
app.use(express.json({ extended: false }));

console.log('[DEBUG index.js] Requiring route files...');
app.use('/api/predict', predictionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribers', subscriberRoutes); // <--- CORRECT: Uses subscriberRoutes

if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client/build'));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Nexus Signal AI Backend is running in development mode!');
    });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Nexus Signal AI server running on port ${PORT}`));