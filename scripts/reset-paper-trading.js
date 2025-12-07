#!/usr/bin/env node
/**
 * Reset paper trading account for a specific user
 * Clears all positions, trades, and resets balance to $100,000
 *
 * Usage: node scripts/reset-paper-trading.js <username or email>
 * Example: node scripts/reset-paper-trading.js cody@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const PaperTradingAccount = require('../models/PaperTradingAccount');

async function resetPaperTrading() {
    const userIdentifier = process.argv[2];

    if (!userIdentifier) {
        console.error('Usage: node scripts/reset-paper-trading.js <username or email>');
        process.exit(1);
    }

    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MongoDB URI not found in environment variables');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find user by username or email
        const user = await User.findOne({
            $or: [
                { username: userIdentifier },
                { email: userIdentifier }
            ]
        });

        if (!user) {
            console.error(`User not found: ${userIdentifier}`);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`Found user: ${user.username || user.email}`);

        // Find and reset or create paper trading account
        let account = await PaperTradingAccount.findOne({ user: user._id });

        if (account) {
            console.log('\nCurrent account state:');
            console.log(`  Cash Balance: $${account.cashBalance?.toLocaleString() || 0}`);
            console.log(`  Portfolio Value: $${account.portfolioValue?.toLocaleString() || 0}`);
            console.log(`  Total Trades: ${account.totalTrades || 0}`);
            console.log(`  Positions: ${account.positions?.length || 0}`);
            console.log(`  Total P/L: $${account.totalProfitLoss?.toLocaleString() || 0}`);
            console.log(`  Total Refill Amount: $${account.totalRefillAmount?.toLocaleString() || 0}`);

            // Reset the account
            account.cashBalance = 100000;
            account.initialBalance = 100000;
            account.portfolioValue = 100000;
            account.positions = [];
            account.tradeHistory = [];
            account.alerts = [];
            account.totalTrades = 0;
            account.winningTrades = 0;
            account.losingTrades = 0;
            account.totalProfitLoss = 0;
            account.totalProfitLossPercent = 0;
            account.winRate = 0;
            account.biggestWin = 0;
            account.biggestLoss = 0;
            account.currentStreak = 0;
            account.bestStreak = 0;
            account.takeProfitHits = 0;
            account.stopLossHits = 0;
            account.trailingStopHits = 0;
            account.liquidations = 0;
            account.refillCount = 0;
            account.totalRefillAmount = 0;
            account.lastRefillDate = null;
            account.lastUpdated = new Date();

            await account.save();
            console.log('\n✅ Paper trading account has been reset!');
        } else {
            // Create fresh account
            account = new PaperTradingAccount({
                user: user._id,
                cashBalance: 100000,
                initialBalance: 100000,
                portfolioValue: 100000,
                positions: [],
                tradeHistory: [],
                alerts: []
            });
            await account.save();
            console.log('\n✅ New paper trading account created!');
        }

        console.log('\nNew account state:');
        console.log(`  Cash Balance: $${account.cashBalance.toLocaleString()}`);
        console.log(`  Portfolio Value: $${account.portfolioValue.toLocaleString()}`);
        console.log(`  Total Trades: ${account.totalTrades}`);
        console.log(`  Total P/L: $${account.totalProfitLoss}`);
        console.log(`  Total Refill Amount: $${account.totalRefillAmount}`);

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error resetting paper trading:', error);
        process.exit(1);
    }
}

resetPaperTrading();
