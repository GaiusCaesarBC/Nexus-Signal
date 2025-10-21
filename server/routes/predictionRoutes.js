const express = require('express');
const router = express.Router();
const axios = require('axios');
const { generatePrediction } = require('../predictionEngine');

// @route   GET api/predict/:symbol
// @desc    Get AI prediction for a stock symbol
// @access  Public
router.get('/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    if (!apiKey) {
        console.error('Alpha Vantage API key is missing.');
        return res.status(500).json({ msg: 'Server configuration error.' });
    }

    // --- CHANGE HERE: Use TIME_SERIES_DAILY_ADJUSTED to get volume ---
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${apiKey}&outputsize=compact&entitlement=delayed`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        // Check for API errors or rate limiting notes
        // Note: The key for adjusted series is "Time Series (Daily)" - same as non-adjusted
        if (data['Error Message'] || data['Note'] || !data['Time Series (Daily)']) {
            console.error('API Error or no Time Series data. Full Response:', data);
            const apiErrorMsg = data['Error Message'] || data['Note'] || `No 'Time Series (Daily)' data found for symbol: ${symbol}. Check symbol or API limits.`;
            // Use 400 for bad symbol, 429 for rate limit (if detectable), 500 otherwise
            let statusCode = 500;
            if (apiErrorMsg.includes("Invalid API call") || apiErrorMsg.includes("symbol")) statusCode = 400;
            if (apiErrorMsg.includes("limit") || apiErrorMsg.includes("premium")) statusCode = 429;

            return res.status(statusCode).json({ msg: apiErrorMsg });
        }

        const timeSeries = data['Time Series (Daily)'];

        // --- UPDATE DATA MAPPING HERE ---
        const historicalData = Object.entries(timeSeries).map(([date, values]) => ({
            date,
            open: parseFloat(values['1. open']),     // Keep for potential future ATR
            high: parseFloat(values['2. high']),     // Keep for potential future ATR
            low: parseFloat(values['3. low']),       // Keep for potential future ATR
            close: parseFloat(values['4. close']),    // Used by SMA, RSI, MACD
            // adjustedClose: parseFloat(values['5. adjusted close']), // Available if needed
            volume: parseInt(values['6. volume']),     // --- ADDED VOLUME ---
            // dividendAmount: parseFloat(values['7. dividend amount']), // Available if needed
            // splitCoefficient: parseFloat(values['8. split coefficient']) // Available if needed
        })).reverse(); // Reverse to have oldest data first for calculations

        // Check minimum data length needed by generatePrediction
        if (historicalData.length < 50) { // generatePrediction now needs at least 50
             return res.status(400).json({ msg: 'Not enough historical data from API to generate a reliable prediction.' });
        }

        // --- Pass the updated historicalData with volume ---
        const prediction = generatePrediction(historicalData);

        // Map data for lightweight-charts format (if using Candlestick)
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
            // Pass the chart-formatted data separately
            historicalData: chartData // Ensure frontend uses this for lightweight-charts
        });

    } catch (err) {
        console.error(`Error in prediction route for ${symbol}:`, err.response ? err.response.data : err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;