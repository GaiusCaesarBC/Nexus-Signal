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

        // Find all predictions without entryPrice set
        const signals = await Prediction.find({
            entryPrice: { $exists: false }
        }).or([
            { entryPrice: null }
        ]);

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

            const range = Math.abs(target - entry);
            const isLong = signal.direction === 'UP';

            // Calculate locked levels using same formula as signalGenerator.js
            const stopLoss = isLong
                ? entry - range * 0.4
                : entry + range * 0.4;

            const takeProfit1 = isLong
                ? entry + range * 0.4
                : entry - range * 0.4;

            const takeProfit2 = target;  // Main target

            const takeProfit3 = isLong
                ? entry + range * 1.5
                : entry - range * 1.5;

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
