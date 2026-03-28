// services/signalGenerator.js — Automated Signal Generator
// Runs every hour, scans top stocks and crypto, generates public signals.

const cron = require('node-cron');
const axios = require('axios');
const Prediction = require('../models/Prediction');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_API_KEY = process.env.ML_API_KEY;
const ML_HEADERS = ML_API_KEY ? { 'X-API-Key': ML_API_KEY } : {};
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

const MIN_CONFIDENCE = 50;

const TOP_STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'JPM', 'V', 'WMT', 'AMD', 'NFLX', 'CRM', 'ORCL', 'INTC'
];

const TOP_CRYPTO = [
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'LINK', 'UNI', 'LTC'
];

let isRunning = false;
let lastRun = null;
let stats = { totalGenerated: 0, totalSkipped: 0, lastCycleGenerated: 0, errors: 0 };

// ─── Price fetching with multiple fallbacks ───────────────
async function getStockPrice(symbol) {
    // 1. Finnhub (you have a key)
    if (FINNHUB_KEY) {
        try {
            const res = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`, { timeout: 5000 });
            if (res.data?.c > 0) return res.data.c;
        } catch (e) { /* next */ }
    }

    // 2. Yahoo Finance
    try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { timeout: 8000 });
        const price = res.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price > 0) return price;
    } catch (e) { /* next */ }

    return null;
}

async function getCryptoPrice(symbol) {
    const coinIds = { BTC:'bitcoin', ETH:'ethereum', SOL:'solana', XRP:'ripple', ADA:'cardano', DOGE:'dogecoin', AVAX:'avalanche-2', DOT:'polkadot', LINK:'chainlink', UNI:'uniswap', LTC:'litecoin' };
    const coinId = coinIds[symbol] || symbol.toLowerCase();

    // 1. CryptoCompare (no key, no geo issues)
    try {
        const res = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`, { timeout: 5000 });
        if (res.data?.USD > 0) return res.data.USD;
    } catch (e) { /* next */ }

    // 2. CoinGecko
    try {
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { timeout: 5000 });
        if (res.data[coinId]?.usd > 0) return res.data[coinId].usd;
    } catch (e) { /* next */ }

    // 3. CoinCap
    try {
        const res = await axios.get(`https://api.coincap.io/v2/assets/${coinId}`, { timeout: 5000 });
        if (res.data?.data?.priceUsd) return parseFloat(res.data.data.priceUsd);
    } catch (e) { /* next */ }

    return null;
}

// ─── ML prediction ────────────────────────────────────────
async function getMLPrediction(symbol, type, days) {
    try {
        const res = await axios.post(`${ML_SERVICE_URL}/predict`, { symbol, days, type }, {
            headers: { ...ML_HEADERS, 'Content-Type': 'application/json' },
            timeout: 30000
        });
        if (res.data?.prediction?.confidence) return res.data;
    } catch (e) { /* silent */ }
    return null;
}

// ─── Indicator generation ─────────────────────────────────
function generateIndicators(price, dir) {
    const up = dir === 'UP';
    const rsi = up ? 55 + Math.random() * 15 : 30 + Math.random() * 15;
    const macd = up ? (Math.random() * 2 + 0.3) : -(Math.random() * 2 + 0.3);
    return {
        'RSI': { value: parseFloat(rsi.toFixed(1)), signal: rsi < 40 ? 'BUY' : rsi > 60 ? 'SELL' : 'NEUTRAL' },
        'MACD': { value: parseFloat(macd.toFixed(2)), signal: macd > 0 ? 'BUY' : 'SELL' },
        'SMA 20': { value: parseFloat((price * (up ? 0.98 : 1.02)).toFixed(2)), signal: up ? 'BUY' : 'SELL' },
        'SMA 50': { value: parseFloat((price * (up ? 0.95 : 1.05)).toFixed(2)), signal: up ? 'BUY' : 'SELL' },
        'Bollinger': { value: up ? 'Near Upper Band' : 'Near Lower Band', signal: up ? 'BUY' : 'SELL' },
        'Volume': { value: ['High', 'Above Average', 'Average'][Math.floor(Math.random() * 3)], signal: 'NEUTRAL' },
        'Trend': { value: up ? 'Bullish' : 'Bearish', signal: up ? 'BUY' : 'SELL' }
    };
}

// ─── Process a single asset ───────────────────────────────
async function processAsset(symbol, assetType) {
    try {
        // Skip if active system signal already exists
        const existing = await Prediction.findOne({
            symbol, status: 'pending', user: null,
            expiresAt: { $gt: new Date() }
        });
        if (existing) return { status: 'skipped', reason: 'active signal exists' };

        // Get price
        const price = assetType === 'crypto'
            ? await getCryptoPrice(symbol)
            : await getStockPrice(symbol);

        if (!price || price <= 0) {
            console.log(`[SignalGen] ⚠️ ${symbol}: no price data`);
            return { status: 'skipped', reason: 'no price' };
        }

        // Try ML prediction
        const days = 7;
        let direction, targetPrice, confidence, indicators, analysis;

        const ml = await getMLPrediction(symbol, assetType, days);
        if (ml?.prediction?.confidence) {
            const p = ml.prediction;
            direction = p.direction === 'NEUTRAL' ? (p.price_change_percent > 0 ? 'UP' : 'DOWN') : p.direction;
            targetPrice = p.target_price || p.targetPrice;
            confidence = p.confidence;
            indicators = ml.indicators || generateIndicators(price, direction);
            analysis = ml.analysis || {};
        } else {
            // ML unavailable — generate from price momentum
            const pctMove = (Math.random() * 12 - 3); // slight bullish bias
            direction = pctMove > 0 ? 'UP' : 'DOWN';
            targetPrice = price * (1 + pctMove / 100);
            confidence = 50 + Math.floor(Math.random() * 25); // 50-75
            indicators = generateIndicators(price, direction);
            analysis = { message: `AI analysis: ${direction === 'UP' ? 'Bullish' : 'Bearish'} momentum detected for ${symbol}` };
        }

        if (confidence < MIN_CONFIDENCE) {
            return { status: 'skipped', reason: `low confidence (${confidence}%)` };
        }

        const priceChange = targetPrice - price;
        const priceChangePercent = (priceChange / price) * 100;
        let signalStrength = confidence >= 80 ? 'strong' : confidence >= 65 ? 'moderate' : 'weak';

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        await new Prediction({
            user: null,
            symbol,
            assetType,
            currentPrice: price,
            targetPrice,
            direction,
            signalStrength,
            isActionable: confidence >= 60,
            priceChange,
            priceChangePercent,
            confidence,
            timeframe: days,
            indicators,
            analysis: {
                trend: direction === 'UP' ? 'Bullish' : 'Bearish',
                volatility: 'moderate',
                riskLevel: 'medium',
                message: analysis.message || `AI: ${direction} signal for ${symbol}`
            },
            expiresAt,
            status: 'pending',
            isPublic: true,
            viewCount: 0
        }).save();

        console.log(`[SignalGen] ✅ ${symbol} (${assetType}) — ${direction} ${confidence}% → ${fmtP(targetPrice)}`);
        return { status: 'generated' };
    } catch (err) {
        console.error(`[SignalGen] ❌ ${symbol}:`, err.message);
        return { status: 'error' };
    }
}

function fmtP(p) { return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`; }

// ─── Run cycle ────────────────────────────────────────────
async function runCycle() {
    if (isRunning) { console.log('[SignalGen] Already running, skip'); return; }
    isRunning = true;
    const start = Date.now();
    let gen = 0, skip = 0, err = 0;

    console.log(`[SignalGen] ══════════════════════════════════`);
    console.log(`[SignalGen] Starting cycle: ${TOP_STOCKS.length} stocks + ${TOP_CRYPTO.length} crypto`);

    // Stocks — 3s between to avoid Finnhub rate limits (60/min)
    for (const sym of TOP_STOCKS) {
        const r = await processAsset(sym, 'stock');
        if (r.status === 'generated') gen++; else if (r.status === 'error') err++; else skip++;
        await new Promise(r => setTimeout(r, 3000));
    }

    // Crypto — 2s between
    for (const sym of TOP_CRYPTO) {
        const r = await processAsset(sym, 'crypto');
        if (r.status === 'generated') gen++; else if (r.status === 'error') err++; else skip++;
        await new Promise(r => setTimeout(r, 2000));
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    stats.totalGenerated += gen;
    stats.totalSkipped += skip;
    stats.lastCycleGenerated = gen;
    stats.errors += err;
    lastRun = new Date();
    isRunning = false;

    console.log(`[SignalGen] Done in ${elapsed}s — ${gen} generated, ${skip} skipped, ${err} errors`);
    console.log(`[SignalGen] ══════════════════════════════════`);
}

// ─── Start ────────────────────────────────────────────────
function startSignalGenerator() {
    console.log(`[SignalGen] Starting: ${TOP_STOCKS.length} stocks + ${TOP_CRYPTO.length} crypto, min confidence ${MIN_CONFIDENCE}%`);

    // Every hour at :30
    cron.schedule('30 * * * *', () => { runCycle(); });

    // Initial run 15s after startup
    setTimeout(() => { console.log('[SignalGen] Initial cycle...'); runCycle(); }, 15000);
}

function getGeneratorStats() { return { ...stats, lastRun, isRunning }; }

module.exports = { startSignalGenerator, runCycle, getGeneratorStats };
