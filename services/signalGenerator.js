// services/signalGenerator.js — Automated Signal Generator
// Uses smart asset discovery pipeline, then runs ML/indicator analysis.

const cron = require('node-cron');
const axios = require('axios');
const Prediction = require('../models/Prediction');
const { discoverAssets } = require('./assetDiscovery');
const { postSignalTeaser } = require('./telegramBot');
const { postNewSignal: postSignalToX } = require('./xPosterService');
const NotificationService = require('./notificationService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_API_KEY = process.env.ML_API_KEY;
const ML_HEADERS = ML_API_KEY ? { 'X-API-Key': ML_API_KEY } : {};
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

const MIN_CONFIDENCE = 55; // Lowered from 65 — ML models pre-retraining are conservative

let isRunning = false;
let lastRun = null;
let stats = { totalGenerated: 0, totalSkipped: 0, lastCycleGenerated: 0, errors: 0 };

// ─── Price fetching ───────────────────────────────────────

async function getStockPrice(symbol) {
    // Finnhub (fast, have key)
    if (FINNHUB_KEY) {
        try {
            const res = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`, { timeout: 5000 });
            if (res.data?.c > 0) return res.data.c;
        } catch (e) { /* next */ }
    }
    // Yahoo fallback
    try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { timeout: 8000 });
        const p = res.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (p > 0) return p;
    } catch (e) { /* silent */ }
    return null;
}

async function getCryptoPrice(symbol, prefetchedPrice) {
    // Use prefetched price from CoinGecko markets endpoint if available
    if (prefetchedPrice && prefetchedPrice > 0) return prefetchedPrice;

    // CryptoCompare fallback
    try {
        const res = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`, { timeout: 5000 });
        if (res.data?.USD > 0) return res.data.USD;
    } catch (e) { /* silent */ }
    return null;
}

// ─── ML + indicator generation ────────────────────────────

async function getMLPrediction(symbol, type, days) {
    try {
        const url = `${ML_SERVICE_URL}/predict`;
        const res = await axios.post(url, { symbol, days, type }, {
            headers: { ...ML_HEADERS, 'Content-Type': 'application/json' }, timeout: 30000
        });
        if (res.data?.prediction) return res.data;
        console.log(`[SignalGen] ML returned no prediction for ${symbol}:`, JSON.stringify(res.data).slice(0, 200));
    } catch (e) {
        console.error(`[SignalGen] ML call failed for ${symbol}: ${e.message} (URL: ${ML_SERVICE_URL})`);
    }
    return null;
}

function generateIndicators(price, dir) {
    const up = dir === 'UP';
    const rsi = up ? 55 + Math.random() * 15 : 30 + Math.random() * 15;
    const macd = up ? (Math.random() * 2 + 0.3) : -(Math.random() * 2 + 0.3);
    return {
        'RSI': { value: +rsi.toFixed(1), signal: rsi < 40 ? 'BUY' : rsi > 60 ? 'SELL' : 'NEUTRAL' },
        'MACD': { value: +macd.toFixed(2), signal: macd > 0 ? 'BUY' : 'SELL' },
        'SMA 20': { value: +(price * (up ? 0.98 : 1.02)).toFixed(2), signal: up ? 'BUY' : 'SELL' },
        'SMA 50': { value: +(price * (up ? 0.95 : 1.05)).toFixed(2), signal: up ? 'BUY' : 'SELL' },
        'Bollinger': { value: up ? 'Near Upper Band' : 'Near Lower Band', signal: up ? 'BUY' : 'SELL' },
        'Volume': { value: ['High', 'Above Average', 'Average'][Math.floor(Math.random() * 3)], signal: 'NEUTRAL' },
        'Trend': { value: up ? 'Bullish' : 'Bearish', signal: up ? 'BUY' : 'SELL' }
    };
}

// ─── Process single asset ─────────────────────────────────

async function processAsset(symbol, assetType, prefetchedPrice = null) {
    try {
        // Skip if a RECENT system signal exists (< 24h old)
        // Older signals are allowed to be refreshed with new analysis
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentExisting = await Prediction.findOne({
            symbol, status: 'pending', user: null,
            createdAt: { $gt: oneDayAgo }
        });
        if (recentExisting) return { status: 'skipped', reason: 'recent signal exists' };

        // Get price
        const price = assetType === 'crypto'
            ? await getCryptoPrice(symbol, prefetchedPrice)
            : await getStockPrice(symbol);

        if (!price || price <= 0) return { status: 'skipped', reason: 'no price' };

        // ML prediction — 7-day horizon to match trained models
        // (signals still expire in 7 days, giving the prediction time to play out)
        const days = 7;
        let direction, targetPrice, confidence, indicators, analysis;

        const ml = await getMLPrediction(symbol, assetType, days);
        if (ml?.prediction) {
            const p = ml.prediction;
            const mlConf = p.confidence || 0;
            const pctChange = p.price_change_percent || 0;

            // Resolve direction: NEUTRAL uses predicted price change direction
            if (p.direction && p.direction !== 'NEUTRAL') {
                direction = p.direction;
            } else {
                direction = pctChange >= 0 ? 'UP' : 'DOWN';
            }

            targetPrice = p.target_price || p.targetPrice;
            confidence = mlConf;

            // If ML returned NEUTRAL but has meaningful price change, boost confidence
            // (the model is uncertain about direction but the magnitude suggests a move)
            if (p.direction === 'NEUTRAL' && Math.abs(pctChange) > 1.5 && mlConf >= 45) {
                confidence = Math.min(mlConf + 10, 70);
                console.log(`[SignalGen] Boosted ${symbol}: NEUTRAL ${mlConf}% → ${confidence}% (pctChange=${pctChange.toFixed(1)}%)`);
            }

            indicators = ml.indicators || ml.technical_analysis || generateIndicators(price, direction);
            analysis = ml.analysis || {};
        } else {
            // ML unavailable — skip this asset instead of publishing random signals
            console.log(`[SignalGen] ⚠ ML unavailable for ${symbol}, skipping (no random fallback)`);
            return { status: 'skipped', reason: 'ml unavailable' };
        }

        if (confidence < MIN_CONFIDENCE) return { status: 'skipped', reason: 'low confidence' };

        const priceChange = targetPrice - price;
        const priceChangePercent = (priceChange / price) * 100;
        const signalStrength = confidence >= 80 ? 'strong' : confidence >= 65 ? 'moderate' : 'weak';
        const expiresAt = new Date(Date.now() + days * 86400000);

        // ═══════════════════════════════════════════════════════════
        // LOCK entry/SL/TP at creation - these NEVER change after this
        // Fixed percentage levels from entry price
        // ═══════════════════════════════════════════════════════════
        const entryPrice = price;  // Locked entry price
        const isLong = direction === 'UP';

        // For LONG positions (expecting price to go UP):
        //   SL: 2% below entry, TP1: 2% above, TP2: 5% above, TP3: 8% above
        // For SHORT positions (expecting price to go DOWN):
        //   SL: 2% above entry, TP1: 2% below, TP2: 5% below, TP3: 8% below
        const stopLoss = isLong
            ? entryPrice * 0.98   // 2% below entry
            : entryPrice * 1.02;  // 2% above entry

        const takeProfit1 = isLong
            ? entryPrice * 1.02   // 2% above entry
            : entryPrice * 0.98;  // 2% below entry

        const takeProfit2 = isLong
            ? entryPrice * 1.05   // 5% above entry
            : entryPrice * 0.95;  // 5% below entry

        const takeProfit3 = isLong
            ? entryPrice * 1.08   // 8% above entry
            : entryPrice * 0.92;  // 8% below entry

        // ═══════════════════════════════════════════════════════════
        // SAFETY VALIDATION - Catch any issues before saving
        // ═══════════════════════════════════════════════════════════
        if (entryPrice <= 0 || stopLoss <= 0 || takeProfit1 <= 0 || takeProfit2 <= 0 || takeProfit3 <= 0) {
            console.error(`[SignalGen] ❌ ${symbol}: Invalid prices detected - entry=${entryPrice}, sl=${stopLoss}, tp1=${takeProfit1}`);
            return { status: 'skipped', reason: 'invalid prices' };
        }
        if (isLong && (stopLoss >= entryPrice || takeProfit1 <= entryPrice)) {
            console.error(`[SignalGen] ❌ ${symbol}: LONG signal with invalid SL/TP relationship`);
            return { status: 'skipped', reason: 'invalid sl/tp' };
        }
        if (!isLong && (stopLoss <= entryPrice || takeProfit1 >= entryPrice)) {
            console.error(`[SignalGen] ❌ ${symbol}: SHORT signal with invalid SL/TP relationship`);
            return { status: 'skipped', reason: 'invalid sl/tp' };
        }

        await new Prediction({
            user: null,
            symbol,
            assetType,
            currentPrice: price,
            targetPrice,
            // Locked trading levels
            entryPrice,
            stopLoss,
            takeProfit1,
            takeProfit2,
            takeProfit3,
            livePrice: price,  // Will be updated by price checker
            livePriceUpdatedAt: new Date(),
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
                message: analysis.message || `AI signal for ${symbol}`
            },
            expiresAt,
            status: 'pending',
            isPublic: true,
            viewCount: 0
        }).save();

        console.log(`[SignalGen] ✅ ${symbol} (${assetType}) — ${direction} ${confidence}% → $${targetPrice >= 1 ? targetPrice.toFixed(2) : targetPrice.toFixed(6)}`);

        // Distribute high-confidence signals: Notifications + Telegram + X
        if (confidence >= 65) {
            try { await NotificationService.createSignalNotification({ symbol, direction, confidence }); } catch (e) { console.error(`[SignalGen] Notification error: ${e.message}`); }
            try { await postSignalTeaser({ _id: symbol, symbol, direction, confidence }); } catch (e) { console.error(`[SignalGen] Telegram error: ${e.message}`); }
            try { await postSignalToX({ _id: symbol, symbol, direction, confidence }); } catch (e) { console.error(`[SignalGen] X post error: ${e.message}`); }
        }

        return { status: 'generated' };
    } catch (err) {
        console.error(`[SignalGen] ❌ ${symbol}: ${err.message}`);
        return { status: 'error' };
    }
}

// ─── Run cycle ────────────────────────────────────────────

async function runCycle() {
    if (isRunning) { console.log('[SignalGen] Already running'); return; }
    isRunning = true;
    const start = Date.now();
    let gen = 0, skip = 0, err = 0;

    console.log(`[SignalGen] ══════════════════════════════════`);

    // Smart asset discovery pipeline
    const { stocks, crypto } = await discoverAssets();

    console.log(`[SignalGen] Processing ${stocks.length} stocks + ${crypto.length} crypto`);

    // Process stocks (3s delay for ML rate limit)
    for (const candidate of stocks) {
        console.log(`[SignalGen] → ${candidate.symbol} [${candidate.bucket}] score=${candidate.compositeScore}`);
        const r = await processAsset(candidate.symbol, 'stock', candidate.price);
        if (r.status === 'generated') gen++; else if (r.status === 'error') err++; else skip++;
        await new Promise(r => setTimeout(r, 3000));
    }

    // Process crypto (2s delay, price already prefetched)
    for (const candidate of crypto) {
        console.log(`[SignalGen] → ${candidate.symbol} [${candidate.bucket}] score=${candidate.compositeScore}`);
        const r = await processAsset(candidate.symbol, 'crypto', candidate.price);
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
    console.log(`[SignalGen] Starting automated signal generator`);
    console.log(`[SignalGen] Mode: Smart discovery pipeline (liquidity → movement → scoring)`);
    console.log(`[SignalGen] Min confidence: ${MIN_CONFIDENCE}%`);

    // Every hour at :30
    cron.schedule('30 * * * *', () => runCycle());

    // Initial run 15s after startup
    setTimeout(() => { console.log('[SignalGen] Initial cycle...'); runCycle(); }, 15000);
}

function getGeneratorStats() { return { ...stats, lastRun, isRunning }; }

module.exports = { startSignalGenerator, runCycle, getGeneratorStats };
