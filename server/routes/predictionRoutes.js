const express = require('express');
const axios = require('axios');
const router = express.Router();
const { generatePrediction } = require('../predictionEngine');

// @route   GET api/predict/:symbol
// @desc    Get AI prediction for a stock symbol
// @access  Public
router.get('/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;

    try {
        console.log(`Fetching data from Alpha Vantage for symbol: ${symbol}`);
        const response = await axios.get(url);
        const data = response.data;

        if (data['Error Message'] || !data['Time Series (Daily)']) {
            console.error('Alpha Vantage API Error for symbol:', symbol, data);
             // Check for premium endpoint message
            if (data['Information'] && data['Information'].includes('premium endpoint')) {
                return res.status(403).json({ msg: 'This is a premium Alpha Vantage endpoint. Please try a different symbol or check your API plan.' });
            }
            return res.status(404).json({ msg: `No data found for symbol: ${symbol}. Check symbol.` });
        }

        const timeSeries = data['Time Series (Daily)'];
        const historicalData = Object.entries(timeSeries)
            .map(([date, values]) => ({
                date,
                close: parseFloat(values['4. close']),
            }))
            .reverse(); // Ensure data is in chronological order

        if (historicalData.length === 0) {
            return res.status(404).json({ msg: `Not enough historical data for symbol: ${symbol}.` });
        }

        const prediction = generatePrediction(historicalData);

        res.json({
            symbol,
            ...prediction,
            historicalData, // Send historical data for the chart
        });
    } catch (err) {
        console.error('Server Error in /api/predict route:', err.message);
        // Log the full error response if available
        if (err.response) {
            console.error('Full API Response:', err.response.data);
        }
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;

