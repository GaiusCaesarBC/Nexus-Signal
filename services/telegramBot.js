// services/telegramBot.js — Nexus Signal AI Telegram Bot
// Synced with /signals page. Same data, same sorting, same quality gate.

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const Prediction = require('../models/Prediction');

const SITE = 'https://www.nexussignal.ai';
const MIN_CONFIDENCE = 65;
let bot = null;
let channelId = null;
let groupId = null;
let lastPostedSignals = new Set();

// Rate limiting
let postsThisHour = 0;
const MAX_POSTS_PER_HOUR = 4;
function canPost() { return postsThisHour < MAX_POSTS_PER_HOUR; }

// ─── Escape MarkdownV2 special chars ──────────────────────
function esc(text) {
    return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// ─── Fetch signals from the clean /signals API endpoint ───
// Same data as frontend /signals page — single source of truth
async function getQualifiedSignals(limit = 20) {
    try {
        const axios = require('axios');
        const API_URL = process.env.API_URL || 'http://localhost:5000/api';
        const res = await axios.get(`${API_URL}/predictions/signals?limit=${limit}&status=active`, { timeout: 10000 });

        if (res.data?.success && res.data?.signals) {
            return res.data.signals.map(s => ({
                ...s,
                long: s.direction === 'LONG'
            }));
        }
        return [];
    } catch (e) {
        // Fallback: query DB directly if API call fails (e.g., during startup)
        try {
            const now = new Date();
            const signals = await Prediction.find({
                confidence: { $gte: MIN_CONFIDENCE },
                $or: [{ status: 'pending' }, { user: null, isPublic: true }],
                expiresAt: { $gt: now }
            }).sort({ confidence: -1 }).limit(limit).lean();

            return signals.map(s => {
                const sym = s.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || s.symbol;
                const conf = Math.round(s.confidence || 0);
                const long = s.direction === 'UP';
                return {
                    id: s._id, symbol: sym, direction: long ? 'LONG' : 'SHORT', long,
                    confidence: conf, tier: conf >= 70 ? 'Strong Setup' : 'Moderate Setup',
                    score: conf >= 70 ? 7 : 5, createdAt: s.createdAt
                };
            }).sort((a, b) => b.score - a.score);
        } catch (dbErr) {
            console.error('[TGBot] Both API and DB failed:', dbErr.message);
            return [];
        }
    }
}

// ─── Get recent stats ─────────────────────────────────────
async function getRecentStats() {
    try {
        const now = new Date();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const recent = await Prediction.find({
            user: null, isPublic: true,
            createdAt: { $gte: dayAgo }
        }).lean();

        const closed = recent.filter(p => p.status === 'correct' || p.status === 'incorrect' || (p.status === 'pending' && new Date(p.expiresAt) < now));
        const winners = closed.filter(p => p.status === 'correct' || p.outcome?.wasCorrect);
        const active = recent.filter(p => p.status === 'pending' && new Date(p.expiresAt) > now && p.confidence >= MIN_CONFIDENCE);
        const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0;

        return { total: recent.length, winners: winners.length, losers: closed.length - winners.length, active: active.length, winRate };
    } catch (e) {
        return { total: 0, winners: 0, losers: 0, active: 0, winRate: 0 };
    }
}

// ─── Message Builders ─────────────────────────────────────

function buildSignalsMessage(signals) {
    if (signals.length === 0) {
        return `No high\\-confidence signals right now\\. Check back soon\\.`;
    }

    const best = signals[0];
    const rest = signals.slice(1, 3);

    let msg = `🔥 *BEST SETUP RIGHT NOW*\n\n`;
    msg += `*${esc(best.symbol)}* — ${best.long ? '📈' : '📉'} *${esc(best.direction)}*\n`;
    msg += `${esc(String(best.confidence))}% — ${esc(best.tier)}\n\n`;

    if (rest.length > 0) {
        msg += `📊 *More Signals:*\n`;
        for (const s of rest) {
            msg += `${s.long ? '📈' : '📉'} *${esc(s.symbol)}* ${esc(s.direction)} — ${esc(String(s.confidence))}% ${esc(s.tier)}\n`;
        }
        msg += `\n`;
    }

    msg += `👉 [View full trade setups \\(entry, SL, TP\\)](${esc(SITE)}/signals)`;
    return msg;
}

function buildTeaserMessage(signal) {
    const dir = signal.long ? '📈' : '📉';
    const tier = signal.confidence >= 70 ? 'Strong Setup' : 'Moderate Setup';
    return `🚨 *AI SIGNAL — ${esc(signal.symbol)}*\n\n${dir} *${esc(signal.direction)}*\n${esc(String(signal.confidence))}% — ${esc(tier)}\n\nFull trade levels inside\\.\n\n👉 [View signal](${esc(SITE)}/signals)`;
}

function buildResultMessage(signal, isWin, movePct) {
    const dir = signal.direction === 'UP' ? 'LONG' : 'SHORT';
    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const icon = isWin ? '✅' : '❌';
    const result = isWin ? 'TARGET HIT' : 'STOP LOSS HIT';
    const pct = `${movePct >= 0 ? '+' : ''}${movePct.toFixed(1)}%`;
    return `${icon} *RESULT — ${esc(sym)} ${esc(dir)}*\n\n${esc(result)} \\(${esc(pct)}\\)\n\nEvery signal tracked\\. No edits\\.\n\n👉 [See all signals](${esc(SITE)}/signals)`;
}

function buildDailyRecap(stats) {
    return `📊 *TODAY'S SIGNALS*\n\n${esc(String(stats.total))} signals generated\n${esc(String(stats.winners))} winners\n${esc(String(stats.losers))} stopped out\n${esc(String(stats.active))} still active\n\nWin rate: *${esc(String(stats.winRate))}%*\n\nEvery signal tracked\\. No deletions\\.\n\n👉 [View all](${esc(SITE)}/signals)`;
}

function buildWelcome() {
    return `👋 *Welcome to Nexus Signal AI*\n\nAI\\-powered trade signals for stocks \\& crypto — tracked and validated\\.\n\nNo fake wins\\. No deleted trades\\.\n\nGet started below 👇`;
}

// ─── Keyboards ────────────────────────────────────────────
const startKeyboard = { reply_markup: { inline_keyboard: [
    [{ text: '🔓 View Live Signals', url: `${SITE}/signals` }],
    [{ text: '🚀 Start Free Trial', url: `${SITE}/pricing` }],
    [{ text: '📊 Today\'s Results', callback_data: 'results' }],
]}};

const signalsKeyboard = { reply_markup: { inline_keyboard: [
    [{ text: '📊 View All Signals', url: `${SITE}/signals` }],
]}};

// ─── Commands ─────────────────────────────────────────────
function setupCommands() {
    if (!bot) return;

    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, buildWelcome(), { parse_mode: 'MarkdownV2', ...startKeyboard })
            .catch(e => console.log('[TGBot] start error:', e.message));
    });

    // /signals — Top 3 from the SAME data as the website
    bot.onText(/\/signals/, async (msg) => {
        const signals = await getQualifiedSignals(20);
        bot.sendMessage(msg.chat.id, buildSignalsMessage(signals), { parse_mode: 'MarkdownV2', ...signalsKeyboard })
            .catch(e => console.log('[TGBot] signals error:', e.message));
    });

    bot.onText(/\/pricing/, (msg) => {
        bot.sendMessage(msg.chat.id, `Unlock full AI signals, trade levels, and tracking\\.\n\n*7\\-day free trial available\\.*`, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: '🚀 View Plans', url: `${SITE}/pricing` }]] }
        }).catch(e => console.log('[TGBot] pricing error:', e.message));
    });

    bot.onText(/\/results/, async (msg) => {
        const stats = await getRecentStats();
        bot.sendMessage(msg.chat.id, `📊 *Recent Performance*\n\nWin Rate: *${esc(String(stats.winRate))}%*\nSignals: *${esc(String(stats.total))}*\nActive: *${esc(String(stats.active))}*\nTracked publicly\n\n👉 [View all](${esc(SITE)}/signals)`, {
            parse_mode: 'MarkdownV2', ...signalsKeyboard
        }).catch(e => console.log('[TGBot] results error:', e.message));
    });

    bot.on('callback_query', async (query) => {
        // X post approval callbacks
        if (query.data?.startsWith('xapprove:') || query.data?.startsWith('xreject:')) {
            try {
                const { handleApprovalCallback } = require('./xPosterService');
                await handleApprovalCallback(query);
            } catch (e) { console.error('[TGBot] X approval error:', e.message); }
            return;
        }

        if (query.data === 'results') {
            const stats = await getRecentStats();
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(query.message.chat.id, `📊 *Today's Performance*\n\nWin Rate: *${esc(String(stats.winRate))}%*\nSignals: *${esc(String(stats.total))}*\nWinners: *${esc(String(stats.winners))}*\nStopped: *${esc(String(stats.losers))}*\n\n👉 [View all](${esc(SITE)}/signals)`, {
                parse_mode: 'MarkdownV2', ...signalsKeyboard
            }).catch(e => console.log('[TGBot] callback error:', e.message));
        }
    });

    console.log('[TGBot] Commands: /start, /signals, /pricing, /results');
}

// ─── Channel Posts (event-driven) ─────────────────────────

// Send to all configured destinations (channel + group)
async function sendToAll(text, options = {}) {
    const targets = [channelId, groupId].filter(Boolean);
    for (const target of targets) {
        try {
            await bot.sendMessage(target, text, options);
        } catch (e) {
            console.error(`[TGBot] Send error (${target}):`, e.message);
        }
    }
}

async function postSignalTeaser(signal) {
    if (!bot || (!channelId && !groupId) || !canPost()) return;
    const conf = Math.round(signal.confidence || 0);
    if (conf < MIN_CONFIDENCE) return;
    if (lastPostedSignals.has(signal._id?.toString())) return;

    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const long = signal.direction === 'UP';

    try {
        await sendToAll(buildTeaserMessage({ symbol: sym, direction: long ? 'LONG' : 'SHORT', long, confidence: conf }), {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: '🔓 View Full Signal', url: `${SITE}/signals` }]] }
        });
        lastPostedSignals.add(signal._id?.toString());
        postsThisHour++;
        console.log(`[TGBot] Posted: ${sym} ${long ? 'LONG' : 'SHORT'} ${conf}%`);
    } catch (e) {
        console.error('[TGBot] Post error:', e.message);
    }
}

async function postResult(signal, isWin, movePct) {
    if (!bot || (!channelId && !groupId) || !canPost()) return;
    try {
        await sendToAll(buildResultMessage(signal, isWin, movePct), {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: '📊 View All Results', url: `${SITE}/signals` }]] }
        });
        postsThisHour++;
    } catch (e) {
        console.error('[TGBot] Result error:', e.message);
    }
}

async function postDailyRecap() {
    if (!bot || (!channelId && !groupId)) return;
    try {
        const stats = await getRecentStats();
        if (stats.total === 0) return;
        await sendToAll(buildDailyRecap(stats), {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [
                [{ text: '🔓 View All Signals', url: `${SITE}/signals` }],
                [{ text: '🚀 Start Free Trial', url: `${SITE}/pricing` }],
            ]}
        });
        console.log(`[TGBot] Daily recap: ${stats.total} signals, ${stats.winRate}% win rate`);
    } catch (e) {
        console.error('[TGBot] Recap error:', e.message);
    }
}

// ─── Initialize ───────────────────────────────────────────
function initializeTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    channelId = process.env.TELEGRAM_CHANNEL_ID;
    groupId = process.env.TELEGRAM_GROUP_ID;

    if (!token) {
        console.log('[TGBot] TELEGRAM_BOT_TOKEN not set — disabled');
        return;
    }

    try {
        bot = new TelegramBot(token, { polling: true });

        let authFails = 0;
        bot.on('polling_error', (error) => {
            if (error.message?.includes('401')) {
                authFails++;
                if (authFails === 1) console.error('[TGBot] ❌ Invalid token (401). Stopping.');
                if (authFails >= 3) { bot.stopPolling(); bot = null; }
                return;
            }
            if (!error.message?.includes('409')) console.error('[TGBot] Error:', error.message);
        });

        setupCommands();

        // Share bot instance with X poster for approval DMs
        try { const { setTelegramBot } = require('./xPosterService'); setTelegramBot(bot); } catch (e) {}

        cron.schedule('0 * * * *', () => { postsThisHour = 0; });
        cron.schedule('0 21 * * *', postDailyRecap);
        cron.schedule('0 */6 * * *', () => { lastPostedSignals.clear(); });

        console.log(`[TGBot] ✅ Initialized${channelId ? ` | channel: ${channelId}` : ''}${groupId ? ` | group: ${groupId}` : ''}`);
    } catch (error) {
        console.error('[TGBot] Init failed:', error.message);
    }
}

module.exports = { initializeTelegramBot, postSignalTeaser, postResult, postDailyRecap };
