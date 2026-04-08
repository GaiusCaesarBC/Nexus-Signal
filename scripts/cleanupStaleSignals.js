#!/usr/bin/env node
/**
 * Cleanup Stale Signals
 *
 * Removes signals that became invalid because of the broken-price era
 * (Gecko Terminal returning wrong-token DEX pools for known centralized
 * cryptos like BNB at $1 instead of $600). Also expires/removes pending
 * signals past their expiry.
 *
 * Three passes:
 *   1) Fetch real current prices for every KNOWN_CRYPTO symbol that has
 *      active signals. Delete any signal whose entryPrice is >40% off
 *      from the real price (clear sign the price source was hijacked).
 *   2) Delete pending signals whose expiresAt is in the past.
 *   3) Delete signals stuck in 'pending' for more than 7 days regardless
 *      of expiresAt (extra safety net for legacy rows).
 *
 * Run:
 *   node scripts/cleanupStaleSignals.js              # dry run by default
 *   node scripts/cleanupStaleSignals.js --apply      # actually delete
 *   node scripts/cleanupStaleSignals.js --apply --symbols BNB,ETH,SOL
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Prediction = require('../models/Prediction');

// ── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const symbolsArgIdx = args.indexOf('--symbols');
const SYMBOL_FILTER = symbolsArgIdx >= 0 && args[symbolsArgIdx + 1]
    ? args[symbolsArgIdx + 1].split(',').map(s => s.trim().toUpperCase())
    : null;
const DIVERGENCE_THRESHOLD = 0.40; // 40% off from real = stale

// ── Known centralized crypto list (mirrors chartRoutes.js) ──────
const KNOWN_CRYPTOS = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
    'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
    'TON', 'BCH', 'TRX', 'ICP', 'FIL', 'XLM', 'XMR', 'HBAR', 'ETC', 'CRO',
    'STX', 'MKR', 'VET', 'GRT', 'SUI', 'TAO', 'TIA', 'SEI', 'ALGO', 'FTM',
    'LDO', 'INJ', 'IMX', 'PYTH', 'FET', 'RUNE', 'JUP', 'WIF', 'PEPE', 'BONK'
];

// ── Real-price fetch via CryptoCompare (no geo block, supports BNB) ─
async function fetchRealPrices(symbols) {
    if (symbols.length === 0) return {};
    // CC supports up to ~50 symbols per request comma-separated
    const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols.join(',')}&tsyms=USD`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        const out = {};
        for (const [sym, payload] of Object.entries(res.data || {})) {
            if (payload && typeof payload.USD === 'number' && payload.USD > 0) {
                out[sym] = payload.USD;
            }
        }
        return out;
    } catch (e) {
        console.error('[Cleanup] CryptoCompare price fetch failed:', e.message);
        return {};
    }
}

async function main() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }

    console.log('[Cleanup] Connecting to MongoDB…');
    await mongoose.connect(mongoUri);
    console.log('[Cleanup] Connected.\n');

    const mode = APPLY ? '🔥 APPLY' : '🧪 DRY-RUN (use --apply to actually delete)';
    console.log(`[Cleanup] Mode: ${mode}`);
    if (SYMBOL_FILTER) console.log(`[Cleanup] Symbol filter: ${SYMBOL_FILTER.join(', ')}\n`);
    else console.log();

    // ─────────────────────────────────────────────────────────────
    // PASS 1 — entryPrice diverges >40% from real price for a known crypto
    // ─────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('PASS 1: divergence from real price (known centralized cryptos)');
    console.log('━'.repeat(70));

    const cryptoQuery = {
        symbol: { $in: SYMBOL_FILTER || KNOWN_CRYPTOS },
        entryPrice: { $exists: true, $gt: 0 }
    };
    const cryptoSignals = await Prediction.find(cryptoQuery);
    console.log(`[Pass 1] Loaded ${cryptoSignals.length} signals on known cryptos`);

    // Group by symbol
    const bySymbol = {};
    for (const s of cryptoSignals) {
        const sym = String(s.symbol).toUpperCase();
        if (!bySymbol[sym]) bySymbol[sym] = [];
        bySymbol[sym].push(s);
    }
    const symbolsToFetch = Object.keys(bySymbol);
    console.log(`[Pass 1] Fetching real prices for ${symbolsToFetch.length} symbols…`);
    const realPrices = await fetchRealPrices(symbolsToFetch);
    console.log(`[Pass 1] Got real prices for ${Object.keys(realPrices).length}/${symbolsToFetch.length} symbols\n`);

    const divergent = [];
    for (const [sym, list] of Object.entries(bySymbol)) {
        const real = realPrices[sym];
        if (!real) {
            console.log(`  ⚠️  ${sym}: no real price returned, skipping ${list.length} signals`);
            continue;
        }
        let count = 0;
        for (const sig of list) {
            const diff = Math.abs(sig.entryPrice - real) / real;
            if (diff > DIVERGENCE_THRESHOLD) {
                divergent.push({ sig, real, diff });
                count++;
            }
        }
        if (count > 0) {
            console.log(`  ❌ ${sym}: real ~$${real.toFixed(2)} → ${count}/${list.length} signals divergent`);
        } else {
            console.log(`  ✅ ${sym}: real ~$${real.toFixed(2)} → all ${list.length} signals OK`);
        }
    }

    console.log(`\n[Pass 1] Total divergent: ${divergent.length}`);
    if (divergent.length > 0 && divergent.length <= 30) {
        console.log('[Pass 1] Sample:');
        for (const { sig, real, diff } of divergent.slice(0, 30)) {
            console.log(`  ${sig.symbol} ${sig.direction} entry=$${sig.entryPrice} real=$${real.toFixed(2)} (${(diff * 100).toFixed(0)}% off) [${sig.status}]`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PASS 2 — pending signals past expiresAt
    // ─────────────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('PASS 2: pending signals past expiresAt');
    console.log('━'.repeat(70));

    const expiredQuery = {
        status: 'pending',
        expiresAt: { $lt: new Date() }
    };
    const expired = await Prediction.find(expiredQuery);
    console.log(`[Pass 2] Found ${expired.length} pending signals past expiry`);

    // ─────────────────────────────────────────────────────────────
    // PASS 3 — pending signals older than 7 days regardless of expiresAt
    // ─────────────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('PASS 3: pending signals older than 7 days');
    console.log('━'.repeat(70));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const ancientPending = await Prediction.find({
        status: 'pending',
        createdAt: { $lt: sevenDaysAgo }
    });
    console.log(`[Pass 3] Found ${ancientPending.length} pending signals older than 7 days`);

    // ─────────────────────────────────────────────────────────────
    // SUMMARY + DELETE
    // ─────────────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('SUMMARY');
    console.log('━'.repeat(70));

    const allIds = new Set();
    divergent.forEach(d => allIds.add(String(d.sig._id)));
    expired.forEach(s => allIds.add(String(s._id)));
    ancientPending.forEach(s => allIds.add(String(s._id)));

    console.log(`  Pass 1 (divergent prices):  ${divergent.length}`);
    console.log(`  Pass 2 (past expiresAt):    ${expired.length}`);
    console.log(`  Pass 3 (>7 days pending):   ${ancientPending.length}`);
    console.log(`  Unique total to delete:     ${allIds.size}\n`);

    if (allIds.size === 0) {
        console.log('[Cleanup] Nothing to delete. ✨');
        await mongoose.disconnect();
        return;
    }

    if (!APPLY) {
        console.log('[Cleanup] Dry run complete. Re-run with --apply to actually delete.');
        await mongoose.disconnect();
        return;
    }

    const objectIds = Array.from(allIds).map(id => new mongoose.Types.ObjectId(id));
    const result = await Prediction.deleteMany({ _id: { $in: objectIds } });
    console.log(`[Cleanup] Deleted ${result.deletedCount} signals`);

    // Updated platform stats
    const total = await Prediction.countDocuments({ user: null, isPublic: true });
    const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
    const losses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
    const closed = wins + losses;
    const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : 0;
    console.log(`\n[Cleanup] Updated platform stats:`);
    console.log(`  Total system signals: ${total}`);
    console.log(`  Wins:                 ${wins}`);
    console.log(`  Losses:               ${losses}`);
    console.log(`  Win Rate:             ${winRate}%`);

    await mongoose.disconnect();
    console.log('\n[Cleanup] Done.');
}

main().catch(err => {
    console.error('[Cleanup] Fatal:', err);
    process.exit(1);
});
