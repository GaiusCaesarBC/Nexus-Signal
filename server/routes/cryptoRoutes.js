// server/routes/cryptoRoutes.js - FINAL FIX: CoinGecko Interval Handling

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000;
const cryptoCache = {};

const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin', ADA: 'cardano',
    SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot', BNB: 'binancecoin',
    LINK: 'chainlink', UNI: 'uniswap', MATIC: 'matic-network', SHIB: 'shiba-inu',
    TRX: 'tron', AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero'
};

function getCoinGeckoDays(range) {
    switch (range) {
        case '1D': return 1;
        case '5D': return 7;
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        case '5Y': return 1825;
        case 'MAX': return 'max';
        default: return 30;
    }
}

const calculateCryptoPrediction = (historicalData, lastClosePrice) => {
    const rsi = calculateRSI(historicalData) || 50;
    const macd = calculateMACD(historicalData) || { macd: 0, signal: 0 };
    const bb = calculateBollingerBands(historicalData) || { mid: lastClosePrice };
    const sma50 = calculateSMA(historicalData, 50);

    let bullishScore = 0, bearishScore = 0, signals = [];
    if (rsi < 30) { bullishScore += 2.5; signals.push(`RSI oversold (${rsi.toFixed(0)})`); }
    else if (rsi > 70) { bearishScore += 2.5; signals.push(`RSI overbought (${rsi.toFixed(0)})`); }
    if (macd.macd > macd.signal) { bullishScore += 3; signals.push("MACD bullish crossover"); }
    else if (macd.macd < macd.signal) { bearishScore += 3; signals.push("MACD bearish divergence"); }
    if (sma50 && lastClosePrice > sma50) { bullishScore += 2; signals.push("Price > 50d SMA"); }
    else if (sma50 && lastClosePrice < sma50) { bearishScore += 2; signals.push("Price < 50d SMA"); }
    if (lastClosePrice >= bb.upper) { bearishScore += 1.5; signals.push("Hit upper Bollinger Band"); }
    else if (lastClosePrice <= bb.lower) { bullishScore += 1.5; signals.push("Hit lower Bollinger Band"); }

    const netScore = bullishScore - bearishScore;
    let confidence = 50 + (Math.abs(netScore) / 12.5) * 45;
    confidence = Math.min(Math.round(confidence), 95);
    let predictedDirection = netScore > 2 ? 'Up' : netScore < -2 ? 'Down' : 'Neutral';
    const percentMove = (netScore / 12.5) * 0.04;
    const predictedPrice = lastClosePrice * (1 + percentMove);
    const percentageChange = ((predictedPrice - lastClosePrice) / lastClosePrice) * 100;

    return {
        historicalData, currentPrice: lastClosePrice, predictedPrice, predictedDirection,
        confidence, percentageChange,
        predictionMessage: signals.length > 0 ? `Signals: ${signals.join(', ')}.` : "Market consolidating.",
        indicators: { rsi, macd, bb, sma50 }
    };
};

router.get('/historical/:symbol', isAuthenticated, async (req, res) => {
    const { symbol } = req.params;
    const { range } = req.query;
    if (!symbol) return res.status(400).json({ msg: 'Crypto symbol required' });

    let fullCoinGeckoUrl = 'N/A'; // Declare here for catch block access

    try {
        const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
        const cacheKey = `crypto-${coinGeckoId}-${range}`;

        if (cryptoCache[cacheKey] && (Date.now() - cryptoCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[Crypto] Serving cached data for ${coinGeckoId}`);
            return res.json(cryptoCache[cacheKey].payload);
        }

        const days = getCoinGeckoDays(range || '1M');
        const coingeckoEndpoint = `/coins/${coinGeckoId}/market_chart`;

        const params = {
            vs_currency: 'usd',
            days: days,
        };

        // --- CRITICAL FIX HERE ---
        // CoinGecko Pro API error: 'interval=hourly is exclusive to Enterprise plan'
        // For days between 2 and 90, CoinGecko automatically returns hourly.
        // For days > 90, it's daily. For days = 1, it's minutely/hourly.
        // We should ONLY specify 'interval=daily' if days > 90 explicitly.
        // Otherwise, omit `interval` and let the API decide.
        if (days > 90) {
            params.interval = 'daily';
        }
        // If days is 1 or between 2-90, we omit the interval parameter as per CoinGecko's tip.
        // The API will automatically return appropriate granularity (e.g., hourly for 2-90 days).
        // --- END CRITICAL FIX ---


        if (COINGECKO_API_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_API_KEY; // Pass key as query param
        }
        
        const queryString = new URLSearchParams(params).toString();
        fullCoinGeckoUrl = `${COINGECKO_BASE_URL}${coingeckoEndpoint}?${queryString}`;
        console.log(`[Crypto] FINAL COINGECKO REQUEST URL: ${fullCoinGeckoUrl}`);

        const response = await axios.get(fullCoinGeckoUrl);

        const prices = response.data.prices || [];
        // CoinGecko's market_chart endpoint also returns total_volumes as part of the main response
        // for the Pro API, so we can likely get it from response.data.total_volumes
        const volumes = response.data.total_volumes || []; // Fetch volumes from the same response

        if (prices.length === 0) return res.status(404).json({ msg: `No data found for ${symbol}` });

        const dataMap = new Map();
        prices.forEach(([ts, p]) => dataMap.set(ts, { time: ts, open: p, high: p, low: p, close: p, volume: 0 }));
        volumes.forEach(([ts, v]) => { // Integrate volumes if available
             if (dataMap.has(ts)) dataMap.get(ts).volume = v;
        });

        const historicalData = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
        
        // Populate open/high/low for candlesticks (if not present) based on close
        for (let i = 1; i < historicalData.length; i++) {
            // If open/high/low aren't directly provided by market_chart for crypto in some cases,
            // we can infer them or use close price for simplicity.
            // CoinGecko's 'market_chart' usually provides [timestamp, price], so we construct OHLC.
            // For now, let's keep the simple inference as it was.
            historicalData[i].open = historicalData[i-1].close; // Using previous close as current open
            historicalData[i].high = Math.max(historicalData[i].open, historicalData[i].close);
            historicalData[i].low = Math.min(historicalData[i].open, historicalData[i].close);
        }

        if (historicalData.length < 30) return res.status(400).json({ msg: 'Not enough data for analysis.' });

        const result = calculateCryptoPrediction(historicalData, historicalData[historicalData.length - 1].close);
        cryptoCache[cacheKey] = { timestamp: Date.now(), payload: result };
        res.json(result);

    } catch (error) {
        console.error(`[Crypto API Error] URL: ${fullCoinGeckoUrl}`);
        console.error('[Crypto API Error] Response Status:', error.response?.status);
        console.error('[Crypto API Error] Response Data:', error.response?.data);
        console.error('[Crypto API Error] Message:', error.message);

        if (error.response?.status === 429) return res.status(429).json({ msg: 'Rate limit exceeded. Please wait.' });
        if (error.response?.status === 401 || error.response?.status === 403) return res.status(401).json({ msg: `CoinGecko API access denied: ${error.response?.data?.status?.error_message || error.message}` });
        res.status(error.response?.status || 500).json({ msg: `Data fetch failed: ${error.message}` });
    }
});

module.exports = router;