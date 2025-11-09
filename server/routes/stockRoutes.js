// server/routes/stockRoutes.js - FINAL ENHANCED PREDICTION VERSION WITH CHART FIX

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware');

const yf = require('yahoo-finance2');
const yahooFinance = yf.default ? new yf.default() : new yf();

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

// Helper to get period1 (start date) and period2 (end date)
function getPeriodDates(range) {
    const now = new Date();
    let period1Date;
    switch (range) {
        case '1D': period1Date = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case '5D': period1Date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); break;
        case '1M': period1Date = new Date(now.setMonth(now.getMonth() - 1)); break;
        case '3M': period1Date = new Date(now.setMonth(now.getMonth() - 3)); break;
        case '6M': period1Date = new Date(now.setMonth(now.getMonth() - 6)); break;
        case '1Y': period1Date = new Date(now.setFullYear(now.getFullYear() - 1)); break;
        case '5Y': period1Date = new Date(now.setFullYear(now.getFullYear() - 5)); break;
        case 'MAX': period1Date = new Date('1980-01-01'); break;
        default: period1Date = new Date(now.setMonth(now.getMonth() - 1)); break;
    }
    return { period1: period1Date, period2: new Date() };
}

// --- ENHANCED STOCK PREDICTION ENGINE (Matches Crypto Logic) ---
const calculateStockPrediction = (historicalData, lastClosePrice) => {
    // 1. Calculate Indicators
    const rsi = calculateRSI(historicalData) || 50;
    const macd = calculateMACD(historicalData) || { macd: 0, signal: 0, histogram: 0 };
    const bb = calculateBollingerBands(historicalData) || { upper: lastClosePrice, lower: lastClosePrice, mid: lastClosePrice };
    const sma20 = calculateSMA(historicalData, 20) || lastClosePrice;
    const sma50 = calculateSMA(historicalData, 50) || lastClosePrice;
    const sma200 = calculateSMA(historicalData, 200) || lastClosePrice;

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    // --- RULE 1: MACD Momentum (Weight: 3) ---
    if (macd.macd > macd.signal) {
        bullishScore += 3;
        signals.push("MACD bullish crossover");
    } else if (macd.macd < macd.signal) {
        bearishScore += 3;
        signals.push("MACD bearish divergence");
    }

    // --- RULE 2: RSI Strength (Weight: 2.5) ---
    if (rsi < 30) {
        bullishScore += 2.5;
        signals.push(`RSI oversold (${rsi.toFixed(0)}) - potential rebound`);
    } else if (rsi > 70) {
        bearishScore += 2.5;
        signals.push(`RSI overbought (${rsi.toFixed(0)}) - potential pullback`);
    } else if (rsi > 50 && rsi <= 70) {
        bullishScore += 0.5;
    } else if (rsi < 50 && rsi >= 30) {
        bearishScore += 0.5;
    }

    // --- RULE 3: Moving Average Trends (Weight: 1, 2, 2.5) ---
    if (lastClosePrice > sma20) { bullishScore += 1; signals.push("Price above 20-day SMA"); }
    else { bearishScore += 1; signals.push("Price below 20-day SMA"); }

    if (lastClosePrice > sma50) { bullishScore += 2; signals.push("Price above 50-day SMA"); }
    else { bearishScore += 2; signals.push("Price below 50-day SMA"); }

    if (lastClosePrice > sma200) {
        bullishScore += 2.5;
        if (sma200 > 0) signals.push("Long-term uptrend (above 200d SMA)");
    } else if (sma200 > 0) {
        bearishScore += 2.5;
        signals.push("Long-term downtrend (below 200d SMA)");
    }

    // --- RULE 4: Bollinger Bands Volatility (Weight: 1.5) ---
    if (lastClosePrice >= bb.upper) {
        bearishScore += 1.5;
        signals.push("Price hit upper Bollinger Band (potential resistance)");
    } else if (lastClosePrice <= bb.lower) {
        bullishScore += 1.5;
        signals.push("Price hit lower Bollinger Band (potential support)");
    }

    // --- FINAL CALCULATION ---
    const totalScore = bullishScore + bearishScore;
    const netScore = bullishScore - bearishScore;
    const maxPossibleScore = 3 + 2.5 + 1 + 2 + 2.5 + 1.5; // 12.5

    // Dynamic Confidence
    let confidence = 50 + (Math.abs(netScore) / maxPossibleScore) * 45;
    confidence = Math.min(Math.round(confidence), 95);

    let predictedDirection = 'Neutral';
    let percentMove = 0;
    const threshold = maxPossibleScore * 0.15; // 15% threshold for direction change

    if (netScore > threshold) {
        predictedDirection = 'Up';
        percentMove = (netScore / maxPossibleScore) * 0.02; // Conservative 2% max move scaling for stocks
    } else if (netScore < -threshold) {
        predictedDirection = 'Down';
        percentMove = (netScore / maxPossibleScore) * 0.02;
    }

    const predictedPrice = lastClosePrice * (1 + percentMove);
    const percentageChange = ((predictedPrice - lastClosePrice) / lastClosePrice) * 100;

    let predictionMessage = signals.length > 0 ? `Analysis based on active signals: ${signals.join(', ')}.` : "Market is consolidating with no clear signals.";
    if (predictedDirection === 'Neutral' && signals.length > 0) {
        predictionMessage = `Conflicting signals detected: ${signals.join(', ')}. Market is neutral.`;
    }

    return {
        historicalData,
        currentPrice: lastClosePrice,
        predictedPrice,
        predictedDirection,
        confidence,
        percentageChange,
        predictionMessage,
        indicators: { rsi: rsi.toFixed(2), macd: macd.macd.toFixed(2), sma50: sma50.toFixed(2) }
    };
};
// ---------------------------------------------------------

router.get('/historical/:symbol', isAuthenticated, async (req, res) => {
    const { symbol } = req.params;
    const { range, interval: frontendInterval } = req.query;

    if (!symbol) return res.status(400).json({ msg: 'Symbol required' });

    try {
        const { period1, period2 } = getPeriodDates(range || '1M');
        let yahooInterval = frontendInterval;

        // --- Yahoo Finance Interval Mapping & Fallbacks ---
        switch (frontendInterval) {
            case '1min': case '5min': case '15min': case '30min':
                yahooInterval = (range === '1D' || range === '5D') ? frontendInterval.replace('min', 'm') : '60m';
                break;
            case '1h': case '60min': case '6h': case '12h':
                 yahooInterval = (['1D', '5D', '1M', '3M'].includes(range)) ? '60m' : '1d';
                 break;
            case '1d': yahooInterval = '1d'; break;
            case '1wk': yahooInterval = '1wk'; break;
            case '1mo': yahooInterval = '1mo'; break;
            default: yahooInterval = '1d';
        }
        // Strict fallbacks for long ranges to prevent 500 errors
        if (['1Y', '5Y', 'MAX'].includes(range) && !['1d', '1wk', '1mo'].includes(yahooInterval)) {
            yahooInterval = '1d';
        }

        const queryOptions = { period1, period2, interval: yahooInterval, events: 'history' };
        // Removed includeAdjustedClose for chart() compatibility.

        const result = await yahooFinance.chart(symbol, queryOptions);

        if (!result || !result.quotes || result.quotes.length === 0) {
            return res.status(404).json({ msg: `No data found for ${symbol} (${range}/${yahooInterval})` });
        }

        const historicalData = result.quotes.map(d => ({
            time: d.date.getTime(), // THIS IS THE CRITICAL FIX: Date object to Unix milliseconds
            open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
        })).filter(d => d.close !== undefined && d.close !== null); // Basic data integrity filter

        if (historicalData.length < 30) {
             return res.status(400).json({ msg: 'Not enough data points for reliable technical analysis. Please select a longer range.' });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        const predictionResult = calculateStockPrediction(historicalData, lastClosePrice);

        res.json(predictionResult);

    } catch (error) {
        console.error('Stock API Error:', error.message);
        if (error.message.includes('Invalid interval')) {
            return res.status(400).json({ msg: `Invalid interval for this range. Try '1 Day'.` });
        }
        res.status(500).json({ msg: `Data fetch failed: ${error.message}` });
    }
});

module.exports = router;