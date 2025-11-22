// server/models/User.js - COMPLETE with Social Features

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    // ✅ Existing watchlist field
    watchlist: {
        type: [String],
        default: []
    },
    // ✅ Existing notification/preferences
    notifications: {
        type: Object,
        default: {}
    },
    appPreferences: {
        type: Object,
        default: {}
    },
    // 🆕 SOCIAL PROFILE
    profile: {
        displayName: { type: String, default: function() { return this.username; } },
        bio: { type: String, maxlength: 500, default: '' },
        avatar: { type: String, default: '' },
        isPublic: { type: Boolean, default: true }, // ✅ Changed from false to true
    showPortfolio: { type: Boolean, default: true }, // ✅ Changed from false to true
        level: { type: Number, default: 1 },
        experience: { type: Number, default: 0 },
        badges: [{ type: String }]
    },
    // 🆕 SOCIAL CONNECTIONS
    social: {
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        followersCount: { type: Number, default: 0 },
        followingCount: { type: Number, default: 0 }
    },
    // 🆕 TRADING STATS
    stats: {
        totalTrades: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        totalReturn: { type: Number, default: 0 },
        totalReturnPercent: { type: Number, default: 0 },
        bestTrade: { type: Number, default: 0 },
        worstTrade: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        rank: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now }
    },
    // 🆕 ACHIEVEMENTS
    achievements: [{
        type: { type: String },
        name: { type: String },
        description: { type: String },
        icon: { type: String },
        earnedAt: { type: Date, default: Date.now }
    }],
    date: {
        type: Date,
        default: Date.now
    }
});

// Method to calculate stats from portfolio
// Method to calculate stats from portfolio and predictions
UserSchema.methods.calculateStats = async function() {
    try {
        console.log('[User] Calculating stats for user:', this.email);

        // Get all portfolio holdings (each holding is a separate document)
        const Portfolio = mongoose.model('Portfolio');
        const holdings = await Portfolio.find({ userId: this._id });

        console.log('[User] Found holdings:', holdings.length);

        // ✅ Handle empty portfolio
        if (!holdings || holdings.length === 0) {
            console.log('[User] No holdings found, setting default stats');
            this.stats = {
                totalInvested: 0,
                currentValue: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                winRate: 0,
                totalTrades: 0,
                profitableTrades: 0,
                losingTrades: 0,
                averageGain: 0,
                averageLoss: 0,
                bestTrade: 0,
                worstTrade: 0,
                currentStreak: 0,
                longestStreak: 0,
                rank: 0,
                lastUpdated: new Date()
            };
            await this.save();
            return this.stats;
        }

        // Calculate portfolio value
        let totalInvested = 0;
        let currentValue = 0;
        let wins = 0;
        let losses = 0;
        let bestTrade = 0;
        let worstTrade = 0;

        for (const holding of holdings) {
            const invested = (holding.averagePrice || 0) * (holding.shares || 0);
            const current = (holding.currentPrice || 0) * (holding.shares || 0);
            const gainLoss = current - invested;
            const gainLossPercent = invested > 0 ? (gainLoss / invested) * 100 : 0;

            totalInvested += invested;
            currentValue += current;

            if (gainLoss > 0) wins++;
            if (gainLoss < 0) losses++;

            // Track best/worst trades
            if (gainLossPercent > bestTrade) bestTrade = gainLossPercent;
            if (gainLossPercent < worstTrade) worstTrade = gainLossPercent;
        }

        // ✅ Safe calculations - prevent NaN
        const totalReturn = currentValue - totalInvested;
        const totalReturnPercent = totalInvested > 0 
            ? (totalReturn / totalInvested) * 100 
            : 0;

        const totalTrades = holdings.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

        // Get prediction stats for streak calculation
        const Prediction = mongoose.model('Prediction');
        const recentPredictions = await Prediction.find({ 
            userId: this._id, 
            status: 'expired' 
        }).sort({ expiresAt: -1 }).limit(100);

        // Calculate streaks
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        for (const pred of recentPredictions) {
            if (pred.wasCorrect) {
                tempStreak++;
                if (tempStreak > longestStreak) longestStreak = tempStreak;
            } else {
                if (currentStreak === 0 && tempStreak > 0) {
                    currentStreak = tempStreak;
                }
                tempStreak = 0;
            }
        }

        // If still on a streak
        if (tempStreak > 0 && currentStreak === 0) {
            currentStreak = tempStreak;
        }

        // Update stats - all values are now safe numbers
        this.stats = {
            totalInvested: totalInvested || 0,
            currentValue: currentValue || 0,
            totalReturn: totalReturn || 0,
            totalReturnPercent: totalReturnPercent || 0,
            winRate: winRate || 0,
            totalTrades: totalTrades || 0,
            profitableTrades: wins || 0,
            losingTrades: losses || 0,
            bestTrade: bestTrade || 0,
            worstTrade: worstTrade || 0,
            currentStreak: currentStreak || 0,
            longestStreak: longestStreak || 0,
            rank: this.stats.rank || 0,
            lastUpdated: new Date()
        };

        console.log('[User] Stats calculated successfully:', {
            totalInvested,
            currentValue,
            totalReturn,
            totalReturnPercent,
            winRate,
            totalTrades
        });

        await this.save();
        return this.stats;

    } catch (error) {
        console.error('[User] Error calculating stats:', error);
        // Don't throw - just return current stats
        return this.stats;
    }
};

module.exports = mongoose.model('User', UserSchema);