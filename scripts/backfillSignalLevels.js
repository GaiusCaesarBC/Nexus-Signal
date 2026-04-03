#!/usr/bin/env node
/**
 * Backfill Migration: Lock Entry/SL/TP Values for Existing Signals
 *
 * This script sets entryPrice, stopLoss, takeProfit1/2/3 on all existing
 * predictions that don't have them, using the same formula as new signals.
 *
 * Run: node scripts/backfillSignalLevels.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');

async function backfillSignalLevels() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not set in environment');
            process.exit(1);
        }

        console.log('[Migration] Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('[Migration] Connected.\n');

        // Find all pending predictions to fix SL/TP levels
        const signals = await Prediction.find({
            status: 'pending'
        });

        console.log(`[Migration] Found ${signals.length} signals to backfill\n`);

        let updated = 0;
        let skipped = 0;

        for (const signal of signals) {
            const entry = signal.currentPrice;
            const target = signal.targetPrice;

            if (!entry || !target || entry <= 0) {
                console.log(`[Skip] ${signal.symbol} - invalid prices (entry=${entry}, target=${target})`);
                skipped++;
                continue;
            }

            const isLong = signal.direction === 'UP';

            // Fixed percentage levels from entry price
            // LONG: SL 2% below, TP1 2%, TP2 5%, TP3 8% above entry
            // SHORT: SL 2% above, TP1 2%, TP2 5%, TP3 8% below entry
            const stopLoss = isLong
                ? entry * 0.98   // 2% below entry
                : entry * 1.02;  // 2% above entry

            const takeProfit1 = isLong
                ? entry * 1.02   // 2% above entry
                : entry * 0.98;  // 2% below entry

            const takeProfit2 = isLong
                ? entry * 1.05   // 5% above entry
                : entry * 0.95;  // 5% below entry

            const takeProfit3 = isLong
                ? entry * 1.08   // 8% above entry
                : entry * 0.92;  // 8% below entry

            // Update the signal
            signal.entryPrice = entry;
            signal.stopLoss = stopLoss;
            signal.takeProfit1 = takeProfit1;
            signal.takeProfit2 = takeProfit2;
            signal.takeProfit3 = takeProfit3;
            signal.livePrice = entry;  // Initialize live price
            signal.livePriceUpdatedAt = signal.createdAt;

            await signal.save();

            console.log(`[Updated] ${signal.symbol} (${signal.direction})`);
            console.log(`          Entry: $${entry.toFixed(entry < 1 ? 6 : 2)}`);
            console.log(`          SL: $${stopLoss.toFixed(stopLoss < 1 ? 6 : 2)}`);
            console.log(`          TP1: $${takeProfit1.toFixed(takeProfit1 < 1 ? 6 : 2)}`);
            console.log(`          TP2: $${takeProfit2.toFixed(takeProfit2 < 1 ? 6 : 2)}`);
            console.log(`          TP3: $${takeProfit3.toFixed(takeProfit3 < 1 ? 6 : 2)}`);
            console.log('');

            updated++;
        }

        console.log('\n[Migration] Complete!');
        console.log(`  Updated: ${updated}`);
        console.log(`  Skipped: ${skipped}`);

        await mongoose.disconnect();
        console.log('[Migration] Disconnected from MongoDB');

    } catch (error) {
        console.error('[Migration] Error:', error.message);
        process.exit(1);
    }
}

backfillSignalLevels();
