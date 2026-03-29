// services/telegramBot.js — Nexus Signal AI Telegram Bot
// Conversion funnel + engagement layer. Teases signals, posts results, drives to website.

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const Prediction = require('../models/Prediction');

const SITE = 'https://www.nexussignal.ai';
let bot = null;
let channelId = null; // Set via env: TELEGRAM_CHANNEL_ID (e.g., @nexussignalai or -100xxxxx)
let lastPostedSignals = new Set(); // Prevent duplicate posts

// ─── Rate limiting ────────────────────────────────────────
let postsThisHour = 0;
const MAX_POSTS_PER_HOUR = 4;

function canPost() {
    return postsThisHour < MAX_POSTS_PER_HOUR;
}

function resetHourlyCounter() {
    postsThisHour = 0;
}

// ─── Message Templates ───────────────────────────────────

function signalTeaser(signal) {
    const dir = signal.direction === 'UP' ? '📈 LONG' : '📉 SHORT';
    const conf = Math.round(signal.confidence || 0);
    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;

    return `🚨 *AI SIGNAL DETECTED — ${sym}*

${dir}
Confidence: *${conf}%*

Setup identified\\. Full trade levels inside\\.

👉 [Unlock this signal](${SITE}/signal/${signal._id})`;
}

function resultMessage(signal, isWin, movePct) {
    const dir = signal.direction === 'UP' ? 'LONG' : 'SHORT';
    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const icon = isWin ? '✅' : '❌';
    const result = isWin ? 'TARGET HIT' : 'STOP LOSS HIT';
    const pct = `${movePct >= 0 ? '+' : ''}${movePct.toFixed(1)}%`;

    return `${icon} *RESULT — ${sym} ${dir}*

${result} \\(${pct}\\)

We don't delete signals\\.
We track everything\\.

👉 [See all signals](${SITE}/signals)`;
}

function dailyRecap(stats) {
    return `📊 *TODAY'S SIGNALS*

${stats.total} signals generated
${stats.winners} winners
${stats.losers} stopped out
${stats.active} still active

Win rate: *${stats.winRate}%*

Every signal tracked\\. No edits\\. No deletions\\.

👉 [View all signals](${SITE}/signals)`;
}

function welcomeMessage() {
    return `👋 *Welcome to Nexus Signal AI*

We generate AI\\-powered trade signals for stocks and crypto — and track every outcome publicly\\.

No fake wins\\. No deleted trades\\.

Get started below 👇`;
}

// ─── Keyboard Buttons ─────────────────────────────────────

const startKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔓 View Live Signals', url: `${SITE}/signals` }],
            [{ text: '🚀 Start Free Trial', url: `${SITE}/pricing` }],
            [{ text: '📊 Today\'s Results', callback_data: 'results' }],
        ]
    }
};

const signalsKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📊 View Live Signals', url: `${SITE}/signals` }],
        ]
    }
};

const pricingKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🚀 View Plans', url: `${SITE}/pricing` }],
        ]
    }
};

// ─── Command Handlers ─────────────────────────────────────

function setupCommands() {
    if (!bot) return;

    // /start
    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, welcomeMessage(), {
            parse_mode: 'MarkdownV2',
            ...startKeyboard
        }).catch(e => console.log('[TGBot] start error:', e.message));
    });

    // /signals
    bot.onText(/\/signals/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `Live signals are updated in real\\-time on the platform\\.\n\n👉 [View signals](${SITE}/signals)`,
            { parse_mode: 'MarkdownV2', ...signalsKeyboard }
        ).catch(e => console.log('[TGBot] signals error:', e.message));
    });

    // /pricing
    bot.onText(/\/pricing/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `Unlock full AI signals, trade levels, and tracking\\.\n\n*7\\-day free trial available\\.*`,
            { parse_mode: 'MarkdownV2', ...pricingKeyboard }
        ).catch(e => console.log('[TGBot] pricing error:', e.message));
    });

    // /results
    bot.onText(/\/results/, async (msg) => {
        const stats = await getRecentStats();
        bot.sendMessage(msg.chat.id,
            `📊 *Recent Performance*\n\nWin Rate: *${stats.winRate}%*\nSignals: *${stats.total}*\nTracked publicly\n\n👉 [View all](${SITE}/signals)`,
            { parse_mode: 'MarkdownV2', ...signalsKeyboard }
        ).catch(e => console.log('[TGBot] results error:', e.message));
    });

    // Callback: results button from /start
    bot.on('callback_query', async (query) => {
        if (query.data === 'results') {
            const stats = await getRecentStats();
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(query.message.chat.id,
                `📊 *Recent Performance*\n\nWin Rate: *${stats.winRate}%*\nSignals: *${stats.total}*\nWinners: *${stats.winners}*\nStopped: *${stats.losers}*\n\n👉 [View all](${SITE}/signals)`,
                { parse_mode: 'MarkdownV2', ...signalsKeyboard }
            ).catch(e => console.log('[TGBot] callback error:', e.message));
        }
    });

    console.log('[TGBot] Commands registered: /start, /signals, /pricing, /results');
}

// ─── Data Fetchers ────────────────────────────────────────

async function getRecentStats() {
    try {
        const now = new Date();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

        const recent = await Prediction.find({
            user: null, isPublic: true,
            createdAt: { $gte: dayAgo }
        }).lean();

        const closed = recent.filter(p => p.status === 'correct' || p.status === 'incorrect' ||
            (p.status === 'pending' && new Date(p.expiresAt) < now));
        const winners = closed.filter(p => p.status === 'correct' ||
            (p.outcome?.wasCorrect === true));
        const losers = closed.filter(p => p.status === 'incorrect' ||
            (p.outcome?.wasCorrect === false));
        const active = recent.filter(p => p.status === 'pending' && new Date(p.expiresAt) > now);

        const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0;

        return {
            total: recent.length,
            winners: winners.length,
            losers: losers.length,
            active: active.length,
            winRate
        };
    } catch (e) {
        console.error('[TGBot] Stats error:', e.message);
        return { total: 0, winners: 0, losers: 0, active: 0, winRate: 0 };
    }
}

// ─── Event-Based Posting ──────────────────────────────────

/**
 * Post a signal teaser to the channel (called by signal generator)
 */
async function postSignalTeaser(signal) {
    if (!bot || !channelId) return;
    if (!canPost()) return;
    if (lastPostedSignals.has(signal._id?.toString())) return;

    try {
        await bot.sendMessage(channelId, signalTeaser(signal), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔓 View Full Signal', url: `${SITE}/signal/${signal._id}` }],
                ]
            }
        });
        lastPostedSignals.add(signal._id?.toString());
        postsThisHour++;
        console.log(`[TGBot] Posted signal teaser: ${signal.symbol}`);
    } catch (e) {
        console.error('[TGBot] Post teaser error:', e.message);
    }
}

/**
 * Post a result to the channel (called by prediction checker)
 */
async function postResult(signal, isWin, movePct) {
    if (!bot || !channelId) return;
    if (!canPost()) return;

    try {
        await bot.sendMessage(channelId, resultMessage(signal, isWin, movePct), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 View All Results', url: `${SITE}/signals` }],
                ]
            }
        });
        postsThisHour++;
        console.log(`[TGBot] Posted result: ${signal.symbol} ${isWin ? 'WIN' : 'LOSS'}`);
    } catch (e) {
        console.error('[TGBot] Post result error:', e.message);
    }
}

/**
 * Post daily recap (called by cron)
 */
async function postDailyRecap() {
    if (!bot || !channelId) return;

    try {
        const stats = await getRecentStats();
        if (stats.total === 0) return; // Don't post if no signals

        await bot.sendMessage(channelId, dailyRecap(stats), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔓 View All Signals', url: `${SITE}/signals` }],
                    [{ text: '🚀 Start Free Trial', url: `${SITE}/pricing` }],
                ]
            }
        });
        console.log(`[TGBot] Posted daily recap: ${stats.total} signals, ${stats.winRate}% win rate`);
    } catch (e) {
        console.error('[TGBot] Daily recap error:', e.message);
    }
}

// ─── Initialize ───────────────────────────────────────────

function initializeTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!token) {
        console.log('[TGBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
        return;
    }

    try {
        bot = new TelegramBot(token, { polling: true });

        bot.on('polling_error', (error) => {
            // Only log non-409 errors (409 = conflict, means another instance is running)
            if (error.code !== 'ETELEGRAM' || !error.message?.includes('409')) {
                console.error('[TGBot] Polling error:', error.message);
            }
        });

        setupCommands();

        // Hourly counter reset
        cron.schedule('0 * * * *', resetHourlyCounter);

        // Daily recap at 9 PM UTC (4 PM EST)
        cron.schedule('0 21 * * *', postDailyRecap);

        // Clean old posted signals cache every 6 hours
        cron.schedule('0 */6 * * *', () => { lastPostedSignals.clear(); });

        console.log(`[TGBot] ✅ Bot initialized${channelId ? ` (channel: ${channelId})` : ' (no channel set)'}`);

        if (!channelId) {
            console.log('[TGBot] Set TELEGRAM_CHANNEL_ID to enable channel posts');
        }
    } catch (error) {
        console.error('[TGBot] Failed to initialize:', error.message);
    }
}

module.exports = {
    initializeTelegramBot,
    postSignalTeaser,
    postResult,
    postDailyRecap,
};
