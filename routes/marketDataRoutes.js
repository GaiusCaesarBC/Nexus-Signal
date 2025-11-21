// server/routes/marketDataRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * Get historical market data for a symbol
 * This fetches OHLC (Open, High, Low, Close) data for candlestick charts
 */
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const days = req.query.days || 60; // Default to 60 days

        console.log(`📊 Fetching ${days} days of historical data for ${symbol}`);

        // Using Alpha Vantage API (you'll need an API key - it's free)
        // Get your free key at: https://www.alphavantage.co/support/#api-key
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
        
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}&outputsize=full`;
        
        const response = await axios.get(url);
        
        if (response.data['Error Message']) {
            return res.status(404).json({ error: 'Invalid symbol' });
        }

        if (response.data['Note']) {
            return res.status(429).json({ error: 'API rate limit reached. Please try again later.' });
        }

        const timeSeries = response.data['Time Series (Daily)'];
        
        if (!timeSeries) {
            return res.status(404).json({ error: 'No data found for this symbol' });
        }

        // Convert to array format
        const historicalData = Object.entries(timeSeries)
            .slice(0, days)
            .map(([date, values]) => ({
                date: date,
                open: parseFloat(values['1. open']),
                high: parseFloat(values['2. high']),
                low: parseFloat(values['3. low']),
                close: parseFloat(values['4. close']),
                volume: parseInt(values['5. volume']),
                // Calculate basic RSI (simplified - you can enhance this)
                rsi: calculateRSI(values),
                // Calculate MACD (simplified - you can enhance this)
                macd: null // You can add MACD calculation here
            }))
            .reverse(); // Oldest to newest

        console.log(`✅ Successfully fetched ${historicalData.length} data points for ${symbol}`);
        
        res.json(historicalData);

    } catch (error) {
        console.error('❌ Error fetching market data:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch market data',
            details: error.message 
        });
    }
});

/**
 * Simplified RSI calculation
 * For production, you should use a proper technical indicators library
 */
function calculateRSI(values) {
    // This is a placeholder - implement proper RSI calculation
    // or use a library like 'technicalindicators'
    const close = parseFloat(values['4. close']);
    const open = parseFloat(values['1. open']);
    const change = ((close - open) / open) * 100;
    
    // Very simplified RSI approximation
    return Math.min(Math.max(50 + change * 2, 0), 100);
}

/**
 * Alternative: Using Yahoo Finance (no API key needed)
 * Uncomment this if you prefer Yahoo Finance
 */
/*
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const days = req.query.days || 60;

        // Calculate date range
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (days * 24 * 60 * 60);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
        
        const response = await axios.get(url);
        
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        const historicalData = timestamps.map((timestamp, index) => ({
            date: new Date(timestamp * 1000).toISOString().split('T')[0],
            open: quotes.open[index],
            high: quotes.high[index],
            low: quotes.low[index],
            close: quotes.close[index],
            volume: quotes.volume[index],
            rsi: null, // Add RSI calculation if needed
            macd: null // Add MACD calculation if needed
        }));

        res.json(historicalData);

    } catch (error) {
        console.error('Error fetching market data:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch market data',
            details: error.message 
        });
    }
});
*/

module.exports = router;