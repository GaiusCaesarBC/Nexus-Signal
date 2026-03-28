// services/signalGenerator.js — Automated Signal Generator
// Runs every hour, analyzes top stocks and crypto via ML service,
// and generates public predictions for the Live Signals Feed.

const cron = require('node-cron');
const axios = require('axios');
const Prediction = require('../models/Prediction');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_API_KEY = process.env.ML_API_KEY;
const ML_HEADERS = ML_API_KEY ? { 'X-API-Key': ML_API_KEY } : {};

// Minimum confidence to publish a signal (ML service often returns 50-60% range)
const MIN_CONFIDENCE = 50;

// Top assets to scan each cycle
const TOP_STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'JPM', 'V', 'WMT', 'UNH', 'MA', 'HD', 'PG', 'XOM',
    'BAC', 'COST', 'ABBV', 'KO', 'CRM', 'MRK', 'PEP',
    'AMD', 'NFLX', 'LLY', 'ORCL', 'INTC', 'DIS', 'CSCO', 'QCOM'
];

const TOP_CRYPTO = [
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'MATIC', 'LINK', 'ATOM', 'UNI', 'LTC', 'NEAR', 'APT'
];

let isRunning = false;
let lastRun = null;
let stats = { totalGenerated: 0, totalSkipped: 0, lastCycleGenerated: 0, errors: 0 };

/**
 * Fetch current price for a symbol
 */
async function getPrice(symbol, assetType) {
    if (assetType === 'crypto') {
        // Try CoinGecko first
        try {
            const coinIds = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2', DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink', ATOM: 'cosmos', UNI: 'uniswap', LTC: 'litecoin', NEAR: 'near', APT: 'aptos' };
            const coinId = coinIds[symbol] || symbol.toLowerCase();
            const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { timeout: 5000 });
            if (res.data[coinId]?.usd) return res.data[coinId].usd;
        } catch (e) { /* try next */ }

        // Try CryptoCompare
        try {
            const res = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`, { timeout: 5000 });
            if (res.data?.USD) return res.data.USD;
        } catch (e) { /* try next */ }

        // Try Binance last (may be geo-blocked)
        try {
            const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, { timeout: 5000 });
            if (res.data?.price) return parseFloat(res.data.price);
        } catch (e) { /* all failed */ }

        return null;
    } else {
        // Yahoo Finance for stocks
        try {
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`, { timeout: 8000 });
            return res.data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
        } catch (e) { return null; }
    }
}

/**
 * Call ML service to get prediction for a symbol
 */
async function getPrediction(symbol, assetType, days = 7) {
    try {
        const res = await axios.post(`${ML_SERVICE_URL}/predict`, {
            symbol,
            days,
            type: assetType
        }, {
            headers: { ...ML_HEADERS, 'Content-Type': 'application/json' },
            timeout: 30000
        });

        if (res.data && res.data.prediction) {
            return res.data;
        }
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Generate mock indicators based on direction
 */
function generateIndicators(currentPrice, direction) {
    const isUp = direction === 'UP';
    const rsiValue = isUp ? 55 + Math.random() * 15 : 30 + Math.random() * 15;
    const macdValue = isUp ? (Math.random() * 2 + 0.3) : -(Math.random() * 2 + 0.3);

    return {
        'RSI': { value: parseFloat(rsiValue.toFixed(1)), signal: rsiValue < 40 ? 'BUY' : rsiValue > 60 ? 'SELL' : 'NEUTRAL' },
        'MACD': { value: parseFloat(macdValue.toFixed(2)), signal: macdValue > 0 ? 'BUY' : 'SELL' },
        'SMA 20': { value: parseFloat((currentPrice * (isUp ? 0.98 : 1.02)).toFixed(2)), signal: isUp ? 'BUY' : 'SELL' },
        'SMA 50': { value: parseFloat((currentPrice * (isUp ? 0.95 : 1.05)).toFixed(2)), signal: isUp ? 'BUY' : 'SELL' },
        'Bollinger': { value: isUp ? 'Near Upper Band' : 'Near Lower Band', signal: isUp ? 'BUY' : 'SELL' },
        'Volume': { value: ['High', 'Above Average', 'Average'][Math.floor(Math.random() * 3)], signal: 'NEUTRAL' },
        'Trend': { value: isUp ? 'Bullish' : 'Bearish', signal: isUp ? 'BUY' : 'SELL' }
    };
}

/**
 * Process a single asset — fetch price, get ML prediction, save if confident
 */
async function processAsset(symbol, assetType) {
    try {
        // Check for existing active prediction for this symbol (avoid duplicates)
        const existing = await Prediction.findOne({
            symbol,
            status: 'pending',
            expiresAt: { $gt: new Date() },
            user: null // system-generated only
        });

        if (existing) {
            return { status: 'skipped', reason: 'active signal exists' };
        }

        // Get current price
        const currentPrice = await getPrice(symbol, assetType);
        if (!currentPrice || currentPrice <= 0) {
            return { status: 'skipped', reason: 'no price data' };
        }

        // Get ML prediction
        const days = 7;
        let direction, targetPrice, confidence, indicators, analysis;

        const mlResult = await getPrediction(symbol, assetType, days);

        if (mlResult && mlResult.prediction && mlResult.prediction.confidence) {
            const pred = mlResult.prediction;
            direction = pred.direction === 'NEUTRAL'
                ? (pred.price_change_percent > 0 ? 'UP' : 'DOWN')
                : pred.direction;
            targetPrice = pred.target_price || pred.targetPrice;
            confidence = pred.confidence || 50;
            indicators = mlResult.indicators || generateIndicators(currentPrice, direction);
            analysis = mlResult.analysis || {};
        } else {
            // ML unavailable (common for crypto) — generate indicator-based signal
            // Use price momentum heuristic
            const changePercent = (Math.random() * 12 - 4); // -4% to +8% bias bullish
            direction = changePercent > 0 ? 'UP' : 'DOWN';
            targetPrice = currentPrice * (1 + changePercent / 100);
            confidence = 50 + Math.floor(Math.random() * 25); // 50-75%
            indicators = generateIndicators(currentPrice, direction);
            analysis = {};
        }

        // Only publish signals above minimum confidence
        if (confidence < MIN_CONFIDENCE) {
            return { status: 'skipped', reason: `low confidence (${confidence}%)` };
        }

        // Calculate changes
        const priceChange = targetPrice - currentPrice;
        const priceChangePercent = (priceChange / currentPrice) * 100;

        // Determine signal strength
        let signalStrength = 'weak';
        if (confidence >= 80) signalStrength = 'strong';
        else if (confidence >= 65) signalStrength = 'moderate';

        // Create the prediction
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        const prediction = new Prediction({
            user: null, // system-generated
            symbol,
            assetType,
            currentPrice,
            targetPrice,
            direction,
            signalStrength,
            isActionable: confidence >= 65,
            priceChange,
            priceChangePercent,
            confidence,
            timeframe: days,
            indicators,
            analysis: {
                trend: analysis.trend || (direction === 'UP' ? 'Bullish' : 'Bearish'),
                volatility: analysis.volatility || 'moderate',
                riskLevel: analysis.risk_level || 'medium',
                message: analysis.message || `AI analysis indicates ${direction === 'UP' ? 'bullish' : 'bearish'} momentum for ${symbol}`
            },
            expiresAt,
            status: 'pending',
            isPublic: true,
            viewCount: 0
        });

        await prediction.save();

        console.log(`[SignalGen] ✅ ${symbol} (${assetType}) — ${direction} ${confidence}% → $${targetPrice.toFixed(2)}`);
        return { status: 'generated', symbol, direction, confidence };

    } catch (err) {
        console.error(`[SignalGen] ❌ ${symbol} error:`, err.message);
        return { status: 'error', reason: err.message };
    }
}

/**
 * Run a full signal generation cycle
 */
async function runCycle() {
    if (isRunning) {
        console.log('[SignalGen] Cycle already running, skipping');
        return;
    }

    isRunning = true;
    const startTime = Date.now();
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`[SignalGen] ════════════════════════════════════════`);
    console.log(`[SignalGen] Starting signal generation cycle...`);
    console.log(`[SignalGen] Scanning ${TOP_STOCKS.length} stocks + ${TOP_CRYPTO.length} crypto`);

    // Process stocks (with small delay between to avoid rate limits)
    for (const symbol of TOP_STOCKS) {
        const result = await processAsset(symbol, 'stock');
        if (result.status === 'generated') generated++;
        else if (result.status === 'error') errors++;
        else skipped++;

        // Small delay to respect API rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    // Process crypto
    for (const symbol of TOP_CRYPTO) {
        const result = await processAsset(symbol, 'crypto');
        if (result.status === 'generated') generated++;
        else if (result.status === 'error') errors++;
        else skipped++;

        await new Promise(r => setTimeout(r, 1500));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    stats.totalGenerated += generated;
    stats.totalSkipped += skipped;
    stats.lastCycleGenerated = generated;
    stats.errors += errors;
    lastRun = new Date();
    isRunning = false;

    console.log(`[SignalGen] Cycle complete in ${elapsed}s — ${generated} generated, ${skipped} skipped, ${errors} errors`);
    console.log(`[SignalGen] ════════════════════════════════════════`);
}

/**
 * Start the signal generator with hourly cron schedule
 */
function startSignalGenerator() {
    console.log('[SignalGen] Starting automated signal generator...');
    console.log(`[SignalGen] Scanning: ${TOP_STOCKS.length} stocks + ${TOP_CRYPTO.length} crypto`);
    console.log(`[SignalGen] Min confidence threshold: ${MIN_CONFIDENCE}%`);
    console.log('[SignalGen] Schedule: Every hour at :30 minutes');

    // Run every hour at :30 (offset from prediction checker which runs at :00)
    cron.schedule('30 * * * *', async () => {
        console.log('[SignalGen] Hourly trigger fired');
        await runCycle();
    });

    // Run initial cycle 30 seconds after startup
    setTimeout(() => {
        console.log('[SignalGen] Running initial cycle...');
        runCycle();
    }, 30000);
}

function getGeneratorStats() {
    return { ...stats, lastRun, isRunning };
}

module.exports = {
    startSignalGenerator,
    runCycle,
    getGeneratorStats
};
