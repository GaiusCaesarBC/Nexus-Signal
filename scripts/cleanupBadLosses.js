#!/usr/bin/env node
/**
 * Cleanup Bad Losses
 *
 * Finds and removes signals that recorded "SL Hit" losses
 * where the loss % doesn't make sense (way more than 2% SL).
 *
 * These are signals that hit broken SL values before the fix.
 *
 * Run: node scripts/cleanupBadLosses.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');

async function cleanupBadLosses() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not set');
            process.exit(1);
        }

        console.log('[Cleanup] Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('[Cleanup] Connected.\n');

        // Find all signals that recorded a loss
        const losses = await Prediction.find({
            result: 'loss',
            resultText: 'SL Hit',
            entryPrice: { $exists: true, $gt: 0 }
        });

        console.log(`[Cleanup] Checking ${losses.length} loss signals...\n`);

        let badLosses = [];

        for (const signal of losses) {
            const entry = signal.entryPrice;
            const resultPrice = signal.resultPrice || signal.livePrice;

            if (!resultPrice || !entry) continue;

            // Calculate what % the "loss" was
            const lossPct = Math.abs((resultPrice - entry) / entry) * 100;

            // If loss was recorded at more than 5% from entry, it's suspicious
            // (our SL is only 2%, so anything beyond ~3% is wrong)
            if (lossPct > 5) {
                badLosses.push({
                    signal,
                    lossPct,
                    reason: `SL hit at ${lossPct.toFixed(1)}% (should be ~2%)`
                });
            }
        }

        console.log(`[Cleanup] Found ${badLosses.length} suspicious losses\n`);

        if (badLosses.length === 0) {
            console.log('[Cleanup] No bad losses found!');

            // Still show stats
            const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
            const allLosses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
            const closed = wins + allLosses;
            const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : 0;
            console.log(`\n[Stats] ${wins}W / ${allLosses}L = ${winRate}%`);

            await mongoose.disconnect();
            return;
        }

        // Show what we're deleting
        console.log('[Cleanup] Bad losses to delete:');
        console.log('─'.repeat(60));
        for (const { signal, lossPct, reason } of badLosses) {
            console.log(`  ${signal.symbol} (${signal.direction}) - ${reason}`);
            console.log(`    Entry: $${signal.entryPrice?.toFixed(6)}, Result: $${signal.resultPrice?.toFixed(6)}`);
        }
        console.log('─'.repeat(60));

        // Delete bad losses
        const badIds = badLosses.map(b => b.signal._id);
        const deleteResult = await Prediction.deleteMany({ _id: { $in: badIds } });

        console.log(`\n[Cleanup] Deleted ${deleteResult.deletedCount} bad loss signals`);

        // Show updated stats
        const total = await Prediction.countDocuments({ user: null, isPublic: true });
        const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
        const remainingLosses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
        const closed = wins + remainingLosses;
        const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : 0;

        console.log(`\n[Cleanup] Updated stats:`);
        console.log(`  Total: ${total}`);
        console.log(`  Wins: ${wins}`);
        console.log(`  Losses: ${remainingLosses}`);
        console.log(`  Win Rate: ${winRate}%`);

        await mongoose.disconnect();
        console.log('\n[Cleanup] Done!');

    } catch (error) {
        console.error('[Cleanup] Error:', error.message);
        process.exit(1);
    }
}

cleanupBadLosses();
