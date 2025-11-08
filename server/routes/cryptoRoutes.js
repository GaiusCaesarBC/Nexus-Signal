// server/routes/cryptoRoutes.js

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware'); // Assuming this path is correct
const axios = require('axios'); // For making CoinGecko API calls

// CRITICAL: Import all new indicator functions
const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVWAP,
} = require('../utils/indicators'); // Import the new indicator library

// --- Simple in-memory cache for crypto data ---
const cryptoCache = {}; // Stores { 'symbol-range-interval': { data: [...], timestamp: Date.now() } }
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper to determine CoinGecko 'days' parameter from our 'range'
function getCoinGeckoDays(range) {
    switch (range) {
        case '1D': return 1;
        case '5D': return 7; // CoinGecko often needs a minimum for fine-grained data
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        case '5Y': return 1825; // Approx 5 years
        case 'MAX': return 'max'; // CoinGecko accepts 'max'
        default: return 30; // Default to 1M (30 days)
    }
}

// === MAIN ROUTE HANDLER: GET HISTORICAL DATA & PREDICTION ===
router.get('/historical/:symbol', isAuthenticated, async (req, res) => {
    const { symbol, range, interval } = req.query; // 'symbol' might be 'id' for CoinGecko
    const coinGeckoId = symbol.toLowerCase(); // CoinGecko often uses lower-case IDs for IDs like 'solana'

    if (!coinGeckoId || !range || !interval) {
        return res.status(400).json({ msg: 'Missing crypto symbol, range, or interval parameters.' });
    }

    const cacheKey = `${coinGeckoId}-${range}-${interval}`;

    // --- CACHING LOGIC ---
    if (cryptoCache[cacheKey] && (Date.now() - cryptoCache[cacheKey].timestamp < CACHE_DURATION)) {
        console.log(`Serving crypto historical data for ${coinGeckoId} from cache.`);
        // Re-run prediction logic on cached data to ensure freshness of analysis
        const cachedPayload = cryptoCache[cacheKey].data;

        // Re-calculate indicators and prediction
        const lastClosePrice = cachedPayload.historicalData[cachedPayload.historicalData.length - 1].close;

        const rsi = calculateRSI(cachedPayload.historicalData);
        const macd = calculateMACD(cachedPayload.historicalData);
        const bb = calculateBollingerBands(cachedPayload.historicalData);
        const vwap = calculateVWAP(cachedPayload.historicalData);
        const sma9 = calculateSMA(cachedPayload.historicalData, 9);
        const sma20 = calculateSMA(cachedPayload.historicalData, 20);
        const sma200 = calculateSMA(cachedPayload.historicalData, 200);

        // --- PREDICTION LOGIC (Rule-Based Heuristic) - Applied to cached data ---
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

        if (bullishScore > bearishScore * 1.2) {
            predictedDirection = 'Up';
            predictedPrice = lastClosePrice * 1.005;
            predictionMessage = `Strong bullish indicators (RSI/MACD convergence) suggest an upward trend.`;
        } else if (bearishScore > bullishScore * 1.2) {
            predictedDirection = 'Down';
            predictedPrice = lastClosePrice * 0.995;
            predictionMessage = `Significant bearish divergence suggests a probable downside correction.`;
        } else {
            predictedDirection = 'Neutral';
            predictedPrice = bb.mid || lastClosePrice;
            predictionMessage = `Market is consolidating. No strong directional conviction currently.`;
        }

        const percentageChange = ((predictedPrice - lastClosePrice) / lastClosePrice) * 100;

        return res.json({
            msg: predictionMessage,
            historicalData: cachedPayload.historicalData,
            currentPrice: lastClosePrice,
            predictedPrice,
            predictedDirection,
            confidence: Math.min(confidence, 99),
            percentageChange,
            predictionMessage,
            indicators: { rsi, macd, bb, vwap, sma9, sma20, sma200 },
        });
    }
    // --- END CACHING LOGIC ---


    try {
        const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
        const days = getCoinGeckoDays(range);

        // CoinGecko 'market_chart' is generally better for free tier and historical prices.
        // It provides [timestamp, price] for 'prices', [timestamp, volume] for 'total_volumes'.
        // To get OHLCV data for indicator calculation, we need to adapt.
        // CoinGecko's /ohlc endpoint is more accurate for OHLC but has stricter limits (max 30 days).
        // For longer ranges, we'll use market_chart and simulate OHLC as best as possible.

        const pricesResponse = await axios.get(
            `${COINGECKO_API_BASE}/coins/${coinGeckoId}/market_chart`,
            {
                params: {
                    vs_currency: 'usd',
                    days: days,
                    // interval: 'daily' is often the only reliable one for longer periods on free tier
                    interval: days <= 90 ? 'daily' : 'daily', // Try to get more granular for <90 days, but default to daily
                },
            }
        );

        const volumeResponse = await axios.get(
            `${COINGECKO_API_BASE}/coins/${coinGeckoId}/market_chart/total_volumes`,
            {
                params: {
                    vs_currency: 'usd',
                    days: days,
                    interval: days <= 90 ? 'daily' : 'daily',
                },
            }
        );


        const pricesData = pricesResponse.data.prices || [];
        const volumesData = volumeResponse.data.total_volumes || [];

        // Merge prices and volumes by timestamp
        const historicalDataMap = new Map();

        pricesData.forEach(([timestamp, price]) => {
            const dateStr = new Date(timestamp).toISOString().split('T')[0];
            if (!historicalDataMap.has(dateStr)) {
                historicalDataMap.set(dateStr, { time: dateStr, open: price, high: price, low: price, close: price, volume: 0 });
            } else {
                const existing = historicalDataMap.get(dateStr);
                existing.high = Math.max(existing.high, price);
                existing.low = Math.min(existing.low, price);
                existing.close = price; // Latest price for the day is close
            }
        });

        volumesData.forEach(([timestamp, volume]) => {
            const dateStr = new Date(timestamp).toISOString().split('T')[0];
            if (historicalDataMap.has(dateStr)) {
                historicalDataMap.get(dateStr).volume = volume;
            }
        });

        const historicalData = Array.from(historicalDataMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time));

        // Ensure we have enough data for indicators
        if (historicalData.length === 0) {
            return res.status(404).json({ msg: `No historical data found for ${symbol}.` });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;

        // --- CALCULATE ALL INDICATORS (on fresh data) ---
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
            predictedPrice = lastClosePrice * 1.005;
            predictionMessage = `Strong bullish indicators (RSI/MACD convergence) suggest an upward trend.`;
        } else if (bearishScore > bullishScore * 1.2) {
            predictedDirection = 'Down';
            predictedPrice = lastClosePrice * 0.995;
            predictionMessage = `Significant bearish divergence suggests a probable downside correction.`;
        } else {
            predictedDirection = 'Neutral';
            predictedPrice = bb.mid || lastClosePrice;
            predictionMessage = `Market is consolidating. No strong directional conviction currently.`;
        }

        const percentageChange = ((predictedPrice - lastClosePrice) / lastClosePrice) * 100;

        // --- FINAL RESPONSE ---
        const responsePayload = {
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
        };

        // Cache the fresh response
        cryptoCache[cacheKey] = {
            data: responsePayload,
            timestamp: Date.now(),
        };

        res.json(responsePayload);

    } catch (error) {
        console.error('Server error fetching crypto data and prediction:', error.response?.data || error.message);
        // Specifically catch 429 errors from CoinGecko
        if (error.response && error.response.status === 429) {
            return res.status(429).json({ msg: 'CoinGecko Rate Limit Exceeded. Please try again in 5-10 seconds.', error: error.message });
        }
        res.status(500).json({ msg: 'Failed to generate crypto prediction', error: error.message });
    }
});

module.exports = router;