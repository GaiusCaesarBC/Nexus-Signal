// services/xPosterService.js — X (Twitter) Auto-Posting Service
// Consumes the same /api/predictions/signals endpoint as website + Telegram.
// Never generates signals. Only distributes.

const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');
const Prediction = require('../models/Prediction');

const SITE = 'https://www.nexussignal.ai';
const MIN_CONFIDENCE = 65;
const ENABLED = process.env.X_AUTO_POST_ENABLED !== 'false'; // Default: enabled
const DRY_RUN = process.env.X_DRY_RUN === 'true'; // Log but don't post

let client = null;
let postedSignals = new Set(); // In-memory idempotency (cleared every 6h)
let postedResults = new Set();
let postsThisHour = 0;
const MAX_POSTS_PER_HOUR = 6;

// ─── Initialize X Client ─────────────────────────────────
function initializeXClient() {
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_KEY_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        console.log('[X] Missing API credentials — X posting disabled');
        return null;
    }

    try {
        client = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken: accessToken,
            accessSecret: accessSecret,
        });
        console.log('[X] ✅ Client initialized');
        return client;
    } catch (e) {
        console.error('[X] Failed to initialize:', e.message);
        return null;
    }
}

// ─── Post to X (with safety) ─────────────────────────────
async function postTweet(text) {
    if (!ENABLED) return null;
    if (postsThisHour >= MAX_POSTS_PER_HOUR) {
        console.log('[X] Rate limit reached, skipping post');
        return null;
    }

    // Truncate to X limit (280 chars)
    const truncated = text.length > 280 ? text.slice(0, 277) + '...' : text;

    if (DRY_RUN) {
        console.log(`[X] DRY RUN (${truncated.length} chars):\n${truncated}`);
        return { id: 'dry-run' };
    }

    if (!client) {
        console.log('[X] Client not initialized, skipping');
        return null;
    }

    try {
        const result = await client.v2.tweet(truncated);
        postsThisHour++;
        console.log(`[X] ✅ Posted (${truncated.length} chars): ${truncated.slice(0, 50)}...`);
        return result.data;
    } catch (e) {
        console.error(`[X] ❌ Post failed:`, e.message);
        if (e.data) console.error('[X] Error data:', JSON.stringify(e.data));
        return null;
    }
}

// ─── Message Templates ────────────────────────────────────

function formatNewSignal(signal, isBest = false) {
    const prefix = isBest ? '🔥 BEST SETUP RIGHT NOW\n\n' : '';
    const dir = signal.direction === 'LONG' ? 'LONG' : 'SHORT';
    const tier = signal.confidence >= 70 ? 'Strong Setup' : 'Moderate Setup';

    return `${prefix}AI Signal — ${signal.symbol}

${dir} | ${signal.confidence}% Confidence
${tier}

Full trade setup on Nexus Signal AI
${SITE}/signals`;
}

function formatResult(signal, isWin, movePct) {
    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const dir = signal.direction === 'UP' ? 'LONG' : 'SHORT';
    const result = isWin ? 'Target Hit' : 'Stopped Out';
    const pct = `${movePct >= 0 ? '+' : ''}${movePct.toFixed(1)}%`;

    return `Signal Result — ${sym} ${dir}

${isWin ? '✅' : '❌'} ${result} (${pct})

Every signal tracked. No edits.
${SITE}/signals`;
}

function formatDailyRecap(stats) {
    return `Daily Signal Recap

Signals: ${stats.total}
Wins: ${stats.winners} | Losses: ${stats.losers}
Win Rate: ${stats.winRate}%

All results tracked publicly.
${SITE}/signals`;
}

// ─── Signal Posting (event-driven) ────────────────────────

async function postNewSignal(signal) {
    if (!ENABLED || !signal) return;
    const conf = Math.round(signal.confidence || 0);
    if (conf < MIN_CONFIDENCE) return;

    const signalId = signal._id?.toString() || signal.id?.toString();
    if (!signalId || postedSignals.has(signalId)) return;

    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;

    // Check if this is the best signal right now
    let isBest = false;
    try {
        const topSignal = await Prediction.findOne({
            confidence: { $gte: MIN_CONFIDENCE },
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }).sort({ confidence: -1 }).lean();
        isBest = topSignal && topSignal._id.toString() === signalId;
    } catch (e) { /* not critical */ }

    const text = formatNewSignal({
        symbol: sym,
        direction: signal.direction === 'UP' ? 'LONG' : 'SHORT',
        confidence: conf
    }, isBest);

    const result = await postTweet(text);
    if (result) {
        postedSignals.add(signalId);
        // Persist to DB
        try {
            await Prediction.updateOne({ _id: signalId }, {
                $set: { xPosted: true, xPostedAt: new Date(), xPostId: result.id }
            });
        } catch (e) { /* non-blocking */ }
    }
}

async function postSignalResult(signal, isWin, movePct) {
    if (!ENABLED || !signal) return;
    const signalId = signal._id?.toString() || signal.id?.toString();
    if (!signalId || postedResults.has(signalId)) return;

    const text = formatResult(signal, isWin, movePct);
    const result = await postTweet(text);
    if (result) {
        postedResults.add(signalId);
        try {
            await Prediction.updateOne({ _id: signalId }, {
                $set: { xResultPosted: true, xResultPostedAt: new Date(), xResultPostId: result.id }
            });
        } catch (e) { /* non-blocking */ }
    }
}

async function postDailyRecap() {
    if (!ENABLED) return;

    try {
        const now = new Date();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const recent = await Prediction.find({
            user: null, isPublic: true,
            createdAt: { $gte: dayAgo }
        }).lean();

        const closed = recent.filter(p => p.status === 'correct' || p.status === 'incorrect' || (p.status === 'pending' && new Date(p.expiresAt) < now));
        const winners = closed.filter(p => p.status === 'correct' || p.outcome?.wasCorrect);
        const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0;

        if (recent.length === 0) return;

        const text = formatDailyRecap({
            total: recent.length,
            winners: winners.length,
            losers: closed.length - winners.length,
            winRate
        });

        await postTweet(text);
        console.log(`[X] Daily recap: ${recent.length} signals, ${winRate}% win rate`);
    } catch (e) {
        console.error('[X] Daily recap error:', e.message);
    }
}

// ─── Initialize ───────────────────────────────────────────
function startXPoster() {
    if (!ENABLED) {
        console.log('[X] Auto-posting disabled (X_AUTO_POST_ENABLED=false)');
        return;
    }

    initializeXClient();

    if (!client && !DRY_RUN) {
        console.log('[X] No client — auto-posting will not work');
        return;
    }

    // Hourly rate limit reset
    cron.schedule('0 * * * *', () => { postsThisHour = 0; });

    // Daily recap at 9:30 PM UTC (offset from Telegram at 9:00 PM)
    cron.schedule('30 21 * * *', postDailyRecap);

    // Clear idempotency caches every 6 hours
    cron.schedule('0 */6 * * *', () => {
        postedSignals.clear();
        postedResults.clear();
    });

    console.log(`[X] ✅ Auto-poster started${DRY_RUN ? ' (DRY RUN MODE)' : ''}`);
}

module.exports = {
    startXPoster,
    postNewSignal,
    postSignalResult,
    postDailyRecap,
};
