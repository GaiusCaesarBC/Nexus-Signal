#!/usr/bin/env node
/**
 * Cleanup Broken Signals
 *
 * Removes signals that had invalid SL/TP values (from the bug where
 * SL/TP were calculated from ML target price instead of fixed %).
 *
 * Identifies broken signals where:
 * - SL is more than 20% away from entry
 * - TP values are negative
 * - SL is on wrong side of entry for direction
 *
 * Run: node scripts/cleanupBrokenSignals.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');

async function cleanupBrokenSignals() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not set');
            process.exit(1);
        }

        console.log('[Cleanup] Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('[Cleanup] Connected.\n');

        // Find all signals with trading levels
        const signals = await Prediction.find({
            entryPrice: { $exists: true, $ne: null },
            stopLoss: { $exists: true, $ne: null }
        });

        console.log(`[Cleanup] Checking ${signals.length} signals for broken values...\n`);

        let broken = [];
        let valid = 0;

        for (const signal of signals) {
            const entry = signal.entryPrice;
            const sl = signal.stopLoss;
            const tp1 = signal.takeProfit1;
            const tp2 = signal.takeProfit2;
            const tp3 = signal.takeProfit3;
            const isLong = signal.direction === 'UP';

            let isBroken = false;
            let reason = '';

            // Check 1: Negative prices
            if (sl <= 0 || tp1 <= 0 || tp2 <= 0 || tp3 <= 0) {
                isBroken = true;
                reason = 'negative prices';
            }

            // Check 2: SL more than 20% from entry
            if (!isBroken && entry > 0) {
                const slDistance = Math.abs(sl - entry) / entry;
                if (slDistance > 0.20) {
                    isBroken = true;
                    reason = `SL ${(slDistance * 100).toFixed(1)}% from entry`;
                }
            }

            // Check 3: SL on wrong side
            if (!isBroken) {
                if (isLong && sl >= entry) {
                    isBroken = true;
                    reason = 'LONG but SL >= entry';
                }
                if (!isLong && sl <= entry) {
                    isBroken = true;
                    reason = 'SHORT but SL <= entry';
                }
            }

            // Check 4: TP on wrong side
            if (!isBroken) {
                if (isLong && (tp1 <= entry || tp2 <= entry || tp3 <= entry)) {
                    isBroken = true;
                    reason = 'LONG but TP <= entry';
                }
                if (!isLong && (tp1 >= entry || tp2 >= entry || tp3 >= entry)) {
                    isBroken = true;
                    reason = 'SHORT but TP >= entry';
                }
            }

            if (isBroken) {
                broken.push({ signal, reason });
            } else {
                valid++;
            }
        }

        console.log(`[Cleanup] Found ${broken.length} broken signals, ${valid} valid\n`);

        if (broken.length === 0) {
            console.log('[Cleanup] No broken signals to remove!');
            await mongoose.disconnect();
            return;
        }

        // Show what we're deleting
        console.log('[Cleanup] Broken signals to delete:');
        console.log('─'.repeat(60));
        for (const { signal, reason } of broken) {
            const resultStr = signal.result ? ` [${signal.result}]` : ' [pending]';
            console.log(`  ${signal.symbol} (${signal.direction})${resultStr} - ${reason}`);
            console.log(`    Entry: $${signal.entryPrice}, SL: $${signal.stopLoss}, TP1: $${signal.takeProfit1}`);
        }
        console.log('─'.repeat(60));

        // Delete broken signals
        const brokenIds = broken.map(b => b.signal._id);
        const deleteResult = await Prediction.deleteMany({ _id: { $in: brokenIds } });

        console.log(`\n[Cleanup] Deleted ${deleteResult.deletedCount} broken signals`);

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

cleanupBrokenSignals();
