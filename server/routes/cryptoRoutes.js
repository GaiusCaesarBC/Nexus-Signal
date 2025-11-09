// server/routes/cryptoRoutes.js - FINAL CONSISTENT VERSION

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config(); // Ensure dotenv is configured to load .env variables

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

// Get CoinGecko API Key and Base URL from environment variables
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3'; // Fallback to free if Pro URL not set

const cryptoCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper to map common symbols to CoinGecko IDs
const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin', ADA: 'cardano',
    SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot', BNB: 'binancecoin',
    LINK: 'chainlink', UNI: 'uniswap', MATIC: 'matic-network', SHIB: 'shiba-inu',
    TRX: 'tron', AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero'
};

function getCoinGeckoDays(range) {
    switch (range) {
        case '1D': return 1;
        case '5D': return 7; // Use 7 days to ensure enough data for 5D range and some lookback
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        case '5Y': return 1825;
        case 'MAX': return 'max';
        default: return 30;
    }
}

// --- PREDICTION ENGINE (Matches Stocks with Dynamic Confidence and Detailed Signals) ---
const calculateCryptoPrediction = (historicalData, lastClosePrice) => {
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
    if (lastClosePrice > sma20) { bullishScore += 1; signals.push("Price above 20-period SMA"); }
    else { bearishScore += 1; signals.push("Price below 20-period SMA"); }

    if (lastClosePrice > sma50) { bullishScore += 2; signals.push("Price above 50-period SMA"); }
    else { bearishScore += 2; signals.push("Price below 50-period SMA"); }

    if (lastClosePrice > sma200) {
        bullishScore += 2.5;
        if (sma200 > 0) signals.push("Long-term uptrend (above 200-period SMA)");
    } else if (sma200 > 0) {
        bearishScore += 2.5;
        signals.push("Long-term downtrend (below 200-period SMA)");
    }

    // --- RULE 4: Bollinger Bands Volatility (Weight: 1.5) ---
    if (lastClosePrice >= bb.upper) {
        bearishScore += 1.5;
        signals.push("Price near upper Bollinger Band (potential resistance)");
    } else if (lastClosePrice <= bb.lower) {
        bullishScore += 1.5;
        signals.push("Price near lower Bollinger Band (potential support)");
    }

    // --- FINAL CALCULATION ---
    const totalScore = bullishScore + bearishScore;
    const netScore = bullishScore - bearishScore;
    // Sum of all max positive weights
    const maxPossibleScore = 3 + 2.5 + 1 + 2 + 2.5 + 1.5;

    // Dynamic Confidence: 50% for perfectly neutral, up to 95% for very strong signals
    let confidence = 50 + (Math.abs(netScore) / maxPossibleScore) * 45;
    confidence = Math.min(Math.round(confidence), 95);

    let predictedDirection = 'Neutral';
    let percentMove = 0;
    const threshold = maxPossibleScore * 0.15; // 15% threshold of max possible score for clear direction

    if (netScore > threshold) {
        predictedDirection = 'Up';
        percentMove = (netScore / maxPossibleScore) * 0.03; // Slightly more volatile % move for crypto
    } else if (netScore < -threshold) {
        predictedDirection = 'Down';
        percentMove = (netScore / maxPossibleScore) * 0.03;
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

router.get('/historical/:symbol', isAuthenticated, async (req, res) => {
    const { symbol } = req.params;
    const { range } = req.query;

    if (!symbol) return res.status(400).json({ msg: 'Crypto symbol required' });

    try {
        const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
        const cacheKey = `crypto-${coinGeckoId}-${range}`;

        if (cryptoCache[cacheKey] && (Date.now() - cryptoCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[Crypto] Serving cached data for ${coinGeckoId}`);
            return res.json(cryptoCache[cacheKey].payload);
        }

        const days = getCoinGeckoDays(range || '1M');
        const intervalParam = days > 90 ? 'daily' : undefined;

        const coingeckoUrl = `${COINGECKO_BASE_URL}/coins/${coinGeckoId}/market_chart`;
        const headers = COINGECKO_API_KEY ? { 'x-cg-pro-api-key': COINGECKO_API_KEY } : {};
        const params = { vs_currency: 'usd', days: days };
        if (intervalParam) params.interval = intervalParam;

        console.log(`[Crypto] Fetching fresh data from: ${coingeckoUrl} with params: ${JSON.stringify(params)}`);

        // Fetch prices and volumes in parallel
        const [pricesRes, totalVolumesRes] = await Promise.all([
            axios.get(coingeckoUrl, { params, headers }),
            axios.get(`${coingeckoUrl}/total_volumes`, { params, headers }) // Separate call for volumes
        ]);

        const prices = pricesRes.data.prices || [];
        const totalVolumes = totalVolumesRes.data.total_volumes || [];

        if (prices.length === 0) {
            return res.status(404).json({ msg: `No historical data found for ${symbol} for range ${range}.` });
        }

        // Merge price and volume data by timestamp
        const dataMap = new Map();
        prices.forEach(([timestamp, price]) => {
            dataMap.set(timestamp, {
                time: timestamp, // CoinGecko provides timestamp in milliseconds already
                open: price, // Will simulate OHL from this
                high: price,
                low: price,
                close: price,
                volume: 0
            });
        });

        totalVolumes.forEach(([timestamp, volume]) => {
            if (dataMap.has(timestamp)) {
                dataMap.get(timestamp).volume = volume;
            } else {
                // Handle cases where volume timestamp doesn't exactly match a price timestamp
                // This can happen with different intervals or slight API inconsistencies.
                // For now, if no price exists, we ignore the volume.
                // A more robust solution might find the nearest price timestamp.
            }
        });

        // Convert Map to sorted array and refine OHLC for candle chart
        const historicalData = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);

        // Populate open, high, low for candlestick charting (simple approximation)
        for (let i = 1; i < historicalData.length; i++) {
            const prevClose = historicalData[i - 1].close;
            historicalData[i].open = prevClose; // Open is previous close
            historicalData[i].high = Math.max(historicalData[i].high, historicalData[i].open, historicalData[i].close);
            historicalData[i].low = Math.min(historicalData[i].low, historicalData[i].open, historicalData[i].close);
        }


        if (historicalData.length < 30) {
            return res.status(400).json({ msg: 'Not enough historical data points for reliable technical analysis. Please select a longer range.' });
        }

        const lastClose = historicalData[historicalData.length - 1].close;
        const predictionResult = calculateCryptoPrediction(historicalData, lastClose);

        cryptoCache[cacheKey] = {
            timestamp: Date.now(),
            payload: predictionResult
        };

        res.json(predictionResult);

    } catch (error) {
        console.error('Server error fetching crypto data and prediction:', error.response?.data?.error || error.message);
        if (error.response && error.response.status === 400) {
            return res.status(400).json({ msg: `CoinGecko API Error: ${error.response.data.error || 'Bad request. Check symbol ID or API key integration.'}` });
        }
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ msg: 'CoinGecko API Error: Unauthorized. Check your API key.' });
        }
        if (error.response && error.response.status === 403) {
            return res.status(403).json({ msg: 'CoinGecko API Error: Forbidden. Check your API key permissions or subscription tier.' });
        }
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ msg: `CoinGecko API Error: Crypto asset '${symbol}' not found.` });
        }
        if (error.response && error.response.status === 429) {
            return res.status(429).json({ msg: 'CoinGecko API Error: Rate limit exceeded. Try again shortly, or ensure your Pro API key is correctly applied.' });
        }
        res.status(500).json({ msg: `Failed to fetch crypto data or generate prediction: ${error.message}` });
    }
});

module.exports = router;