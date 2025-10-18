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

    // We've added the '&entitlement=delayed' parameter to the URL for premium data
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact&entitlement=delayed`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        // Check for API errors or rate limiting notes
        if (!data['Time Series (Daily)']) {
            console.error('API did not return "Time Series (Daily)". Full API Response:', data);
            return res.status(404).json({ msg: `No data found for symbol: ${symbol}. Check symbol or API limit.` });
        }

        const timeSeries = data['Time Series (Daily)'];
        const historicalData = Object.entries(timeSeries).map(([date, values]) => ({
            date,
            close: parseFloat(values['4. close']),
        })).reverse(); // Reverse to have oldest data first

        if (historicalData.length < 50) {
             return res.status(400).json({ msg: 'Not enough historical data to generate a prediction.' });
        }

        const prediction = generatePrediction(historicalData);

        res.json({
            symbol,
            ...prediction,
            historicalData
        });

    } catch (err) {
        console.error('Error in prediction route:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

