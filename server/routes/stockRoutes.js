// server/routes/stocks.js

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware'); // Assuming this path is correct
const yahooFinance = require('yahoo-finance2').default; // Ensure correct import

// CRITICAL: Import all new indicator functions
const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVWAP,
} = require('../utils/indicators'); // Import the new indicator library

// Helper function to dynamically get period1 for yahooFinance.historical
// This is important because 'range' in your UI doesn't directly map to yahooFinance's period1
function getPeriod1Date(range) {
    const today = new Date();
    switch (range) {
        case '1D': return new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0];
        case '5D': return new Date(today.setDate(today.getDate() - 5)).toISOString().split('T')[0];
        case '1M': return new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
        case '3M': return new Date(today.setMonth(today.getMonth() - 3)).toISOString().split('T')[0];
        case '6M': return new Date(today.setMonth(today.getMonth() - 6)).toISOString().split('T')[0];
        case '1Y': return new Date(today.setFullYear(today.getFullYear() - 1)).toISOString().split('T')[0];
        case '5Y': return new Date(today.setFullYear(today.getFullYear() - 5)).toISOString().split('T')[0];
        case 'MAX': return '1970-01-01'; // Or a very early date supported by Yahoo Finance
        default: return new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0]; // Default to 1 Month
    }
}

// === MAIN ROUTE HANDLER: GET HISTORICAL DATA & PREDICTION ===
router.get('/historical/:symbol', isAuthenticated, async (req, res) => {
    const { symbol, range, interval } = req.query;

    if (!symbol || !range || !interval) {
        return res.status(400).json({ msg: 'Missing symbol, range, or interval parameters.' });
    }

    try {
        // Fetch historical data using the calculated start date
        const stockData = await yahooFinance.historical(symbol, {
            period1: getPeriod1Date(range),
            interval: interval,
        });

        // Map Yahoo Finance data to a consistent OHLCV format
        const historicalData = stockData.map(data => ({
            time: data.date.toISOString().split('T')[0], // YYYY-MM-DD
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
        }));

        if (historicalData.length === 0) {
            return res.status(404).json({ msg: `No historical data found for ${symbol}.` });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;

        // --- CALCULATE ALL INDICATORS ---
        const rsi = calculateRSI(historicalData);
        const macd = calculateMACD(historicalData);
        const bb = calculateBollingerBands(historicalData);
        const vwap = calculateVWAP(historicalData);
        const sma9 = calculateSMA(historicalData, 9);
        const sma20 = calculateSMA(historicalData, 20);
        const sma200 = calculateSMA(historicalData, 200);

        // --- PREDICTION LOGIC (Rule-Based Heuristic) ---
        let bullishScore = 0;
        let bearishScore = 0;

        // Rule 1: MACD Crossover (Bullish/Bearish signal line crossover)
        if (macd.macd !== null && macd.signal !== null) {
            if (macd.macd > macd.signal) bullishScore += 2;
            else if (macd.macd < macd.signal) bearishScore += 2;
        }

        // Rule 2: RSI Overbought/Oversold (RSI below 30 is bullish, above 70 is bearish)
        if (rsi !== null) {
            if (rsi < 30) bullishScore += 1.5;
            else if (rsi > 70) bearishScore += 1.5;
        }

        // Rule 3: Moving Average Crossover (Current price vs. 9-period SMA)
        if (sma9 !== null) {
            if (lastClosePrice > sma9) bullishScore += 1;
            else if (lastClosePrice < sma9) bearishScore += 1;
        }

        // Rule 4: Long-Term Trend (Current price vs. 200-period SMA)
        if (sma200 !== null) {
            if (lastClosePrice > sma200) bullishScore += 1;
            else if (lastClosePrice < sma200) bearishScore += 1;
        }

        const totalScore = bullishScore + bearishScore;
        const confidence = totalScore > 0 ? Math.round((Math.max(bullishScore, bearishScore) / totalScore) * 100) : 50;

        let predictedDirection = 'Neutral';
        let predictedPrice = lastClosePrice;
        let predictionMessage = 'Prediction model is awaiting stronger signals.';

        if (bullishScore > bearishScore * 1.2) { // 20% bias required
            predictedDirection = 'Up';
            // Predict a price slightly above the current price, using SMA9 as a possible short-term target
            predictedPrice = lastClosePrice * 1.005; 
            predictionMessage = `Strong bullish indicators (RSI/MACD convergence) suggest an upward trend.`;
        } else if (bearishScore > bullishScore * 1.2) {
            predictedDirection = 'Down';
            predictedPrice = lastClosePrice * 0.995;
            predictionMessage = `Significant bearish divergence suggests a probable downside correction.`;
        } else {
            // Predict the price to be near the mid-band of the Bollinger Bands if available,
            // or just the last closing price if the trend is neutral.
            predictedDirection = 'Neutral';
            predictedPrice = bb.mid || lastClosePrice;
            predictionMessage = `Market is consolidating. No strong directional conviction currently.`;
        }

        const percentageChange = ((predictedPrice - lastClosePrice) / lastClosePrice) * 100;

        // --- FINAL RESPONSE ---
        res.json({
            msg: predictionMessage,
            historicalData,
            currentPrice: lastClosePrice,
            predictedPrice,
            predictedDirection,
            confidence: Math.min(confidence, 99), // Cap confidence at 99%
            percentageChange,
            predictionMessage,
            // OPTIONAL: Include indicator values for debugging/display
            indicators: { rsi, macd, bb, vwap, sma9, sma20, sma200 },
        });

    } catch (error) {
        console.error('Server error fetching stock data and prediction:', error.message);
        res.status(500).json({ msg: 'Failed to generate stock prediction', error: error.message });
    }
});

module.exports = router;