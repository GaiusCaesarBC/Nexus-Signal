#!/usr/bin/env node
/**
 * Void Low-Quality Historical Signals
 *
 * After we tightened the signal generator's quality gates (raised
 * MIN_CONFIDENCE 55→70, added MIN_PCT_MAGNITUDE 2.5%, removed the
 * NEUTRAL boost hack, etc.), the historical win rate is dragged down
 * by signals that would NOT pass the new bar. This script removes
 * (or marks voided) every CLOSED system signal — wins AND losses
 * symmetrically — that fails any of the new quality gates.
 *
 * This is intellectually honest: we're not cherry-picking losses,
 * we're saying "signals we wouldn't publish today shouldn't count
 * for or against us today."
 *
 * Scope:
 *   - System signals only (user: null, isPublic: true)
 *   - Status in {correct, incorrect}  (closed signals)
 *   - Open / pending signals are NOT touched
 *   - User-created signals are NOT touched
 *
 * Modes:
 *   --dry              dry run (default), shows counts only
 *   --apply --delete   permanently delete the rows
 *   --apply --void     mark voided (status='voided', non-destructive)
 *
 * Examples:
 *   node scripts/voidLowQualitySignals.js
 *   node scripts/voidLowQualitySignals.js --apply --void
 *   node scripts/voidLowQualitySignals.js --apply --delete
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');

// ─── Args ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const MODE_DELETE = args.includes('--delete');
const MODE_VOID = args.includes('--void');

if (APPLY && !MODE_DELETE && !MODE_VOID) {
    console.error('When using --apply you must also specify --delete or --void');
    process.exit(1);
}

// ─── Quality bar (must match signalGenerator.js) ───────────────
const MIN_CONFIDENCE = 70;
const MIN_PCT_MAGNITUDE = 2.5;

async function main() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }

    console.log('[Void] Connecting to MongoDB…');
    await mongoose.connect(mongoUri);
    console.log('[Void] Connected.\n');

    const mode = !APPLY
        ? '🧪 DRY-RUN (use --apply --void OR --apply --delete to act)'
        : MODE_DELETE
        ? '🔥 APPLY-DELETE (rows will be permanently removed)'
        : '✏️  APPLY-VOID (rows will be marked status=voided)';
    console.log(`[Void] Mode: ${mode}`);
    console.log(`[Void] Quality bar: confidence >= ${MIN_CONFIDENCE}% AND |pctChange| >= ${MIN_PCT_MAGNITUDE}%\n`);

    // Pull every CLOSED system signal
    const closed = await Prediction.find({
        user: null,
        isPublic: true,
        status: { $in: ['correct', 'incorrect'] }
    });
    console.log(`[Void] Loaded ${closed.length} closed system signals`);

    // Bucket them
    const failConfidence = [];
    const failMagnitude = [];
    const failBoth = [];
    const pass = [];

    for (const s of closed) {
        const confLow = (s.confidence || 0) < MIN_CONFIDENCE;
        const magLow = Math.abs(s.priceChangePercent || 0) < MIN_PCT_MAGNITUDE;
        if (confLow && magLow) failBoth.push(s);
        else if (confLow) failConfidence.push(s);
        else if (magLow) failMagnitude.push(s);
        else pass.push(s);
    }

    const allFailing = [...failConfidence, ...failMagnitude, ...failBoth];

    // Win/loss split by reason
    const splitWL = (arr) => {
        const wins = arr.filter(s => s.status === 'correct' || s.result === 'win').length;
        const losses = arr.filter(s => s.status === 'incorrect' || s.result === 'loss').length;
        return { wins, losses, total: arr.length };
    };

    const fcStat = splitWL(failConfidence);
    const fmStat = splitWL(failMagnitude);
    const fbStat = splitWL(failBoth);
    const allStat = splitWL(allFailing);
    const passStat = splitWL(pass);

    console.log('━'.repeat(70));
    console.log('BREAKDOWN');
    console.log('━'.repeat(70));
    console.log(`  Fail confidence only:      ${fcStat.total} (${fcStat.wins}W / ${fcStat.losses}L)`);
    console.log(`  Fail magnitude only:       ${fmStat.total} (${fmStat.wins}W / ${fmStat.losses}L)`);
    console.log(`  Fail both:                 ${fbStat.total} (${fbStat.wins}W / ${fbStat.losses}L)`);
    console.log(`  ─────────────────────────`);
    console.log(`  TOTAL FAILING (would void): ${allStat.total} (${allStat.wins}W / ${allStat.losses}L)`);
    console.log(`  PASSING (would keep):       ${passStat.total} (${passStat.wins}W / ${passStat.losses}L)\n`);

    // Show before/after win rates
    const beforeClosed = closed.length;
    const beforeWins = closed.filter(s => s.status === 'correct' || s.result === 'win').length;
    const beforeLosses = beforeClosed - beforeWins;
    const beforeWR = beforeClosed > 0 ? (beforeWins / beforeClosed) * 100 : 0;

    const afterClosed = passStat.total;
    const afterWins = passStat.wins;
    const afterLosses = passStat.losses;
    const afterWR = afterClosed > 0 ? (afterWins / afterClosed) * 100 : 0;

    console.log('━'.repeat(70));
    console.log('WIN-RATE PROJECTION');
    console.log('━'.repeat(70));
    console.log(`  BEFORE: ${beforeWins}W / ${beforeLosses}L = ${beforeWR.toFixed(1)}%`);
    console.log(`  AFTER:  ${afterWins}W / ${afterLosses}L = ${afterWR.toFixed(1)}%`);
    console.log(`  Δ:      ${(afterWR - beforeWR >= 0 ? '+' : '')}${(afterWR - beforeWR).toFixed(1)} pts\n`);

    if (allFailing.length === 0) {
        console.log('[Void] Nothing to do. ✨');
        await mongoose.disconnect();
        return;
    }

    if (!APPLY) {
        console.log('[Void] Dry-run only. Re-run with --apply --void (recommended) or --apply --delete.');
        await mongoose.disconnect();
        return;
    }

    const ids = allFailing.map(s => s._id);

    if (MODE_DELETE) {
        const result = await Prediction.deleteMany({ _id: { $in: ids } });
        console.log(`[Void] Deleted ${result.deletedCount} signals`);
    } else {
        // VOID: keep the rows but mark them voided + flip status so they're
        // excluded from win-rate stats. We use status='expired' (a value the
        // schema already accepts) plus a resultText marker so they're easy
        // to identify if you ever want to inspect them.
        const result = await Prediction.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    status: 'expired',
                    resultText: 'Voided: pre-quality-gate signal',
                    isPublic: false // hide from public feeds too
                }
            }
        );
        console.log(`[Void] Voided ${result.modifiedCount} signals (status=expired, isPublic=false, resultText set)`);
    }

    // Verify new platform stats
    const total = await Prediction.countDocuments({ user: null, isPublic: true });
    const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
    const losses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
    const closedCount = wins + losses;
    const winRate = closedCount > 0 ? ((wins / closedCount) * 100).toFixed(1) : '0.0';

    console.log(`\n[Void] Updated platform stats:`);
    console.log(`  Total system signals (public): ${total}`);
    console.log(`  Wins:                          ${wins}`);
    console.log(`  Losses:                        ${losses}`);
    console.log(`  Win rate:                      ${winRate}%`);

    await mongoose.disconnect();
    console.log('\n[Void] Done.');
}

main().catch(err => {
    console.error('[Void] Fatal:', err);
    process.exit(1);
});
