#!/usr/bin/env node
/**
 * Cleanup Bad Price Results
 *
 * Removes signals where the result was recorded from bad price data
 * (e.g., wrong token, API returning garbage like $0.00000069)
 *
 * Identifies signals where result price is >50% different from entry.
 *
 * Run: node scripts/cleanupBadPriceResults.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');

async function cleanupBadPriceResults() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not set');
            process.exit(1);
        }

        console.log('[Cleanup] Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('[Cleanup] Connected.\n');

        // Find all signals with a result
        const signals = await Prediction.find({
            result: { $in: ['win', 'loss'] },
            entryPrice: { $exists: true, $gt: 0 },
            resultPrice: { $exists: true, $gt: 0 }
        });

        console.log(`[Cleanup] Checking ${signals.length} closed signals for bad price data...\n`);

        let badResults = [];

        for (const signal of signals) {
            const entry = signal.entryPrice;
            const resultPrice = signal.resultPrice;

            // Calculate how far result price is from entry
            const priceDiff = Math.abs(resultPrice - entry) / entry;

            // If result price is >50% different from entry, it's bad data
            if (priceDiff > 0.50) {
                badResults.push({
                    signal,
                    priceDiff,
                    reason: `Result price ${priceDiff > 10 ? '>1000%' : (priceDiff * 100).toFixed(0) + '%'} from entry`
                });
            }
        }

        console.log(`[Cleanup] Found ${badResults.length} signals with bad price data\n`);

        if (badResults.length === 0) {
            console.log('[Cleanup] No bad results found!');

            // Show stats
            const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
            const losses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
            const closed = wins + losses;
            const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : 0;
            console.log(`\n[Stats] ${wins}W / ${losses}L = ${winRate}%`);

            await mongoose.disconnect();
            return;
        }

        // Show what we're deleting
        console.log('[Cleanup] Bad results to delete:');
        console.log('─'.repeat(60));
        for (const { signal, reason } of badResults) {
            console.log(`  ${signal.symbol} (${signal.direction}) [${signal.result}] - ${reason}`);
            console.log(`    Entry: $${signal.entryPrice}, Result: $${signal.resultPrice}`);
        }
        console.log('─'.repeat(60));

        // Delete bad results
        const badIds = badResults.map(b => b.signal._id);
        const deleteResult = await Prediction.deleteMany({ _id: { $in: badIds } });

        console.log(`\n[Cleanup] Deleted ${deleteResult.deletedCount} signals with bad price data`);

        // Show updated stats
        const total = await Prediction.countDocuments({ user: null, isPublic: true });
        const wins = await Prediction.countDocuments({ user: null, isPublic: true, result: 'win' });
        const losses = await Prediction.countDocuments({ user: null, isPublic: true, result: 'loss' });
        const closed = wins + losses;
        const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : 0;

        console.log(`\n[Cleanup] Updated stats:`);
        console.log(`  Total: ${total}`);
        console.log(`  Wins: ${wins}`);
        console.log(`  Losses: ${losses}`);
        console.log(`  Win Rate: ${winRate}%`);

        await mongoose.disconnect();
        console.log('\n[Cleanup] Done!');

    } catch (error) {
        console.error('[Cleanup] Error:', error.message);
        process.exit(1);
    }
}

cleanupBadPriceResults();
