// services/xPosterService.js — X Posting with Telegram Approval
// Flow: Generate text → Save pending → DM admin → Approve/Reject → Post to X

const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');
const Prediction = require('../models/Prediction');
const PendingXPost = require('../models/PendingXPost');

const SITE = 'https://www.nexussignal.ai';
const MIN_CONFIDENCE = 65;
const ENABLED = process.env.X_AUTO_POST_ENABLED !== 'false';
const REQUIRE_APPROVAL = process.env.X_REQUIRE_TELEGRAM_APPROVAL !== 'false'; // Default: true
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_USER_ID;

let xClient = null;
let telegramBot = null; // Set by telegramBot.js after init
let postedSignalIds = new Set();
let postsThisHour = 0;
const MAX_POSTS_PER_HOUR = 6;

// ─── X Client ─────────────────────────────────────────────
function initializeXClient() {
    const k = process.env.X_API_KEY;
    const ks = process.env.X_API_KEY_SECRET;
    const t = process.env.X_ACCESS_TOKEN;
    const ts = process.env.X_ACCESS_TOKEN_SECRET;
    if (!k || !ks || !t || !ts) { console.log('[X] Missing credentials — disabled'); return; }
    try {
        xClient = new TwitterApi({ appKey: k, appSecret: ks, accessToken: t, accessSecret: ts });
        console.log('[X] ✅ Client ready');
    } catch (e) { console.error('[X] Init failed:', e.message); }
}

// Called by telegramBot.js to share its bot instance
function setTelegramBot(bot) { telegramBot = bot; }

// ─── Post to X (final step) ──────────────────────────────
async function postToX(text) {
    if (!ENABLED) { console.log('[X] Disabled'); return null; }
    if (!xClient) { console.log('[X] No client initialized'); return null; }
    if (postsThisHour >= MAX_POSTS_PER_HOUR) { console.log('[X] Rate limit'); return null; }
    const t = text.length > 280 ? text.slice(0, 277) + '...' : text;
    try {
        console.log(`[X] Attempting post (${t.length} chars)...`);
        const result = await xClient.v2.tweet(t);
        postsThisHour++;
        console.log(`[X] ✅ Posted! Tweet ID: ${result.data?.id}`);
        return result.data;
    } catch (e) {
        console.error(`[X] ❌ POST FAILED`);
        console.error(`[X] Message: ${e.message}`);
        console.error(`[X] Code: ${e.code}`);
        console.error(`[X] HTTP Status: ${e.data?.status || e.response?.status || 'unknown'}`);
        console.error(`[X] Response body: ${JSON.stringify(e.data || {})}`);
        console.error(`[X] Errors array: ${JSON.stringify(e.errors || e.data?.errors || [])}`);
        if (e.data?.detail) console.error(`[X] Detail: ${e.data.detail}`);
        if (e.data?.title) console.error(`[X] Title: ${e.data.title}`);
        if (e.rateLimit) console.error(`[X] Rate limit: ${JSON.stringify(e.rateLimit)}`);
        return null;
    }
}

// Manual test — add route or call from console
async function testXPost() {
    console.log('[X] ═══ MANUAL TEST ═══');
    console.log(`[X] Client: ${!!xClient}, Enabled: ${ENABLED}`);
    console.log(`[X] X_API_KEY: ${process.env.X_API_KEY ? 'SET (' + process.env.X_API_KEY.slice(0, 6) + '...)' : 'MISSING'}`);
    console.log(`[X] X_API_KEY_SECRET: ${process.env.X_API_KEY_SECRET ? 'SET' : 'MISSING'}`);
    console.log(`[X] X_ACCESS_TOKEN: ${process.env.X_ACCESS_TOKEN ? 'SET' : 'MISSING'}`);
    console.log(`[X] X_ACCESS_TOKEN_SECRET: ${process.env.X_ACCESS_TOKEN_SECRET ? 'SET' : 'MISSING'}`);

    if (!xClient) { initializeXClient(); }
    if (!xClient) { console.error('[X] Cannot init client — check keys'); return null; }

    // Verify auth
    try {
        const me = await xClient.v2.me();
        console.log(`[X] ✅ Authenticated as @${me.data.username}`);
    } catch (authErr) {
        console.error(`[X] ❌ Auth failed: ${authErr.message}`);
        console.error(`[X] Auth data: ${JSON.stringify(authErr.data || {})}`);
        return null;
    }

    return await postToX(`Test from Nexus Signal AI — ${new Date().toISOString()}`);
}

// ─── Message Templates ────────────────────────────────────
function fmtNewSignal(sym, dir, conf, isBest) {
    const prefix = isBest ? '🔥 BEST SETUP RIGHT NOW\n\n' : '';
    const tier = conf >= 70 ? 'Strong Setup' : 'Moderate Setup';
    return `${prefix}AI Signal — ${sym}\n\n${dir} | ${conf}% Confidence\n${tier}\n\nFull trade setup on Nexus Signal AI\n${SITE}/signals`;
}

function fmtResult(sym, dir, isWin, pct) {
    const r = isWin ? 'Target Hit' : 'Stopped Out';
    return `Signal Result — ${sym} ${dir}\n\n${isWin ? '✅' : '❌'} ${r} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)\n\nEvery signal tracked. No edits.\n${SITE}/signals`;
}

function fmtRecap(stats) {
    return `Daily Signal Recap\n\nSignals: ${stats.total}\nWins: ${stats.winners} | Losses: ${stats.losers}\nWin Rate: ${stats.winRate}%\n\nAll results tracked publicly.\n${SITE}/signals`;
}

// ─── Create Pending Post + Send Approval ──────────────────
async function queueForApproval(type, content, signalId = null) {
    if (!ENABLED) return;

    // Idempotency: check if already pending/approved/posted for this signal+type
    if (signalId) {
        const existing = await PendingXPost.findOne({
            signalId, type, status: { $in: ['pending', 'approved', 'posted'] }
        });
        if (existing) return; // Already queued
    }

    // Save pending post
    const pending = await new PendingXPost({ type, signalId, content, status: 'pending' }).save();

    if (!REQUIRE_APPROVAL) {
        // Skip approval — post directly
        return await approveAndPost(pending._id.toString());
    }

    // Send approval DM to admin via Telegram
    if (!telegramBot || !ADMIN_USER_ID) {
        console.log('[X] No Telegram bot or admin ID — cannot send approval. Posting directly.');
        return await approveAndPost(pending._id.toString());
    }

    const typeLabel = { new_signal: 'New Signal', best_setup: 'Best Setup', result_update: 'Signal Result', daily_recap: 'Daily Recap' }[type] || type;

    const msg = `📝 *X Post Pending Approval*\n\nType: ${typeLabel}\n\nPreview:\n\`\`\`\n${content}\n\`\`\``;

    try {
        const sent = await telegramBot.sendMessage(ADMIN_USER_ID, msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Approve', callback_data: `xapprove:${pending._id}` },
                    { text: '❌ Reject', callback_data: `xreject:${pending._id}` },
                ]]
            }
        });

        pending.telegramMessageId = sent.message_id;
        pending.telegramChatId = ADMIN_USER_ID;
        await pending.save();

        console.log(`[X] Approval sent for ${typeLabel} (${pending._id})`);
    } catch (e) {
        console.error('[X] Failed to send approval DM:', e.message);
        // Fallback: post directly if can't reach admin
        await approveAndPost(pending._id.toString());
    }
}

// ─── Approve + Post ───────────────────────────────────────
async function approveAndPost(pendingId) {
    const post = await PendingXPost.findById(pendingId);
    if (!post || post.status !== 'pending') return { ok: false, reason: 'not pending' };

    // Atomic status update (concurrency safety)
    const updated = await PendingXPost.findOneAndUpdate(
        { _id: pendingId, status: 'pending' },
        { $set: { status: 'approved', approvedAt: new Date() } },
        { new: true }
    );
    if (!updated) return { ok: false, reason: 'already processed' };

    const result = await postToX(post.content);
    if (result) {
        await PendingXPost.updateOne({ _id: pendingId }, {
            $set: { status: 'posted', postedAt: new Date(), xPostId: result.id }
        });
        // Also update Prediction record if applicable
        if (post.signalId) {
            const updateField = post.type === 'result_update' ? 'xResultPosted' : 'xPosted';
            await Prediction.updateOne({ _id: post.signalId }, { $set: { [updateField]: true } }).catch(() => {});
        }
        return { ok: true, xPostId: result.id };
    } else {
        await PendingXPost.updateOne({ _id: pendingId }, {
            $set: { status: 'failed', error: 'X API post failed' }
        });
        return { ok: false, reason: 'X API failed' };
    }
}

// ─── Reject ───────────────────────────────────────────────
async function rejectPost(pendingId) {
    const updated = await PendingXPost.findOneAndUpdate(
        { _id: pendingId, status: 'pending' },
        { $set: { status: 'rejected', rejectedAt: new Date() } },
        { new: true }
    );
    return { ok: !!updated };
}

// ─── Telegram Callback Handler ────────────────────────────
// Called by the Telegram bot's callback_query handler
async function handleApprovalCallback(query) {
    const data = query.data;
    if (!data?.startsWith('xapprove:') && !data?.startsWith('xreject:')) return false;

    const [action, pendingId] = data.split(':');
    const isApprove = action === 'xapprove';

    let responseText;
    if (isApprove) {
        const result = await approveAndPost(pendingId);
        responseText = result.ok
            ? `✅ Posted to X successfully.${result.xPostId ? ` (ID: ${result.xPostId})` : ''}`
            : `⚠️ Could not post: ${result.reason}`;
    } else {
        const result = await rejectPost(pendingId);
        responseText = result.ok ? '❌ Post rejected.' : '⚠️ Already processed.';
    }

    // Reply to the approval message
    try {
        await telegramBot.answerCallbackQuery(query.id, { text: responseText.slice(0, 200) });
        await telegramBot.editMessageReplyMarkup(
            { inline_keyboard: [[{ text: responseText.slice(0, 50), callback_data: 'noop' }]] },
            { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
    } catch (e) { /* non-critical */ }

    return true;
}

// ─── Public API (called by signal generator + prediction checker) ─

async function postNewSignal(signal) {
    if (!ENABLED || !signal) return;
    const conf = Math.min(95, Math.round(signal.confidence || 0));
    if (conf < MIN_CONFIDENCE) return;
    const sid = signal._id?.toString();
    if (sid && postedSignalIds.has(sid)) return;

    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const dir = signal.direction === 'UP' ? 'LONG' : 'SHORT';

    // Check if best
    let isBest = false;
    try {
        const top = await Prediction.findOne({ confidence: { $gte: MIN_CONFIDENCE }, status: 'pending', expiresAt: { $gt: new Date() } }).sort({ confidence: -1 }).lean();
        isBest = top && top._id.toString() === sid;
    } catch (e) {}

    const content = fmtNewSignal(sym, dir, conf, isBest);
    const type = isBest ? 'best_setup' : 'new_signal';

    await queueForApproval(type, content, signal._id);
    if (sid) postedSignalIds.add(sid);
}

async function postSignalResult(signal, isWin, movePct) {
    if (!ENABLED || !signal) return;
    const sym = signal.symbol?.split(':')[0]?.replace(/USDT|USD/i, '') || signal.symbol;
    const dir = signal.direction === 'UP' ? 'LONG' : 'SHORT';
    const content = fmtResult(sym, dir, isWin, movePct);
    await queueForApproval('result_update', content, signal._id);
}

async function postDailyRecap() {
    if (!ENABLED) return;
    try {
        const now = new Date();
        const dayAgo = new Date(now - 86400000);
        const recent = await Prediction.find({ user: null, isPublic: true, createdAt: { $gte: dayAgo } }).lean();
        const closed = recent.filter(p => p.status === 'correct' || p.status === 'incorrect' || (p.status === 'pending' && new Date(p.expiresAt) < now));
        const winners = closed.filter(p => p.status === 'correct' || p.outcome?.wasCorrect);
        const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0;
        if (recent.length === 0) return;

        const content = fmtRecap({ total: recent.length, winners: winners.length, losers: closed.length - winners.length, winRate });
        await queueForApproval('daily_recap', content);
    } catch (e) { console.error('[X] Recap error:', e.message); }
}

// ─── Start ────────────────────────────────────────────────
function startXPoster() {
    if (!ENABLED) { console.log('[X] Disabled'); return; }
    initializeXClient();

    cron.schedule('0 * * * *', () => { postsThisHour = 0; });
    cron.schedule('30 21 * * *', postDailyRecap);
    cron.schedule('0 */6 * * *', () => { postedSignalIds.clear(); });

    console.log(`[X] ✅ Started${REQUIRE_APPROVAL ? ' (approval required)' : ' (direct posting)'}`);
}

module.exports = {
    startXPoster, setTelegramBot, handleApprovalCallback,
    postNewSignal, postSignalResult, postDailyRecap, testXPost,
};
