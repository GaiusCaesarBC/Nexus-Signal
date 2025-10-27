// server/routes/predictionRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { generatePrediction } = require('../predictionEngine');
const auth = require('../middleware/authMiddleware'); // <--- NEW: Import auth middleware

console.log('[predictionRoutes.js] Module loaded. Defining prediction route...');

// @route   GET api/predict/:symbol
// @desc    Get AI prediction for a stock symbol
// @access  Private (requires authentication due to 'auth' middleware)
router.get('/:symbol', auth, async (req, res) => { // <--- NEW: 'auth' middleware added here
   console.log(`[predictionRoutes.js] Hit route for /api/predict/${req.params.symbol} by user ${req.user ? req.user.id : 'unknown'}`);
    const symbol = req.params.symbol.toUpperCase();
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    // Log the user ID to confirm authentication is working (optional, for debugging)
    // console.log(`[Prediction Route] User ${req.user.id} requested prediction for ${symbol}`);

    if (!apiKey) {
        console.error('Alpha Vantage API key is missing.');
        return res.status(500).json({ msg: 'Server configuration error.' });
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${apiKey}&outputsize=compact&entitlement=delayed`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data['Error Message'] || data['Note'] || !data['Time Series (Daily)']) {
            console.error('API Error or no Time Series data. Full Response:', data);
            const apiErrorMsg = data['Error Message'] || data['Note'] || `No 'Time Series (Daily)' data found for symbol: ${symbol}. Check symbol or API limits.`;
            let statusCode = 500;
            if (apiErrorMsg.includes("Invalid API call") || apiErrorMsg.includes("symbol")) statusCode = 400;
            if (apiErrorMsg.includes("limit") || apiErrorMsg.includes("premium")) statusCode = 429;

            return res.status(statusCode).json({ msg: apiErrorMsg });
        }

        const timeSeries = data['Time Series (Daily)'];

        const historicalData = Object.entries(timeSeries).map(([date, values]) => ({
            date,
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseInt(values['6. volume']),
        })).reverse();

        if (historicalData.length < 50) {
            return res.status(400).json({ msg: 'Not enough historical data from API to generate a reliable prediction.' });
        }

        const prediction = generatePrediction(historicalData);

        const chartData = historicalData.map(d => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        res.json({
            symbol,
            ...prediction,
            historicalData: chartData
        });

    } catch (err) {
        console.error(`Error in prediction route for ${symbol}:`, err.response ? err.response.data : err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;