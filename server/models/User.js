// server/models/User.js - COMPLETE with Social Features + Subscription

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
        isPublic: { type: Boolean, default: false },
        showPortfolio: { type: Boolean, default: false },
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
    // 💳 SUBSCRIPTION
    subscription: {
        status: { 
            type: String, 
            enum: ['free', 'starter', 'pro', 'premium', 'elite', 'canceled'],
            default: 'free' 
        },
        stripeCustomerId: { type: String },
        stripeSubscriptionId: { type: String },
        currentPeriodEnd: { type: Date },
        cancelAtPeriodEnd: { type: Boolean, default: false }
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Method to calculate stats from portfolio
UserSchema.methods.calculateStats = async function() {
    try {
        const Portfolio = mongoose.model('Portfolio');
        const portfolio = await Portfolio.findOne({ user: this._id });
        
        if (portfolio && portfolio.holdings.length > 0) {
            let totalGainLoss = 0;
            let totalCost = 0;
            let wins = 0;
            let losses = 0;
            
            portfolio.holdings.forEach(holding => {
                const currentValue = holding.currentPrice * holding.shares;
                const costBasis = holding.averagePrice * holding.shares;
                const gainLoss = currentValue - costBasis;
                
                totalGainLoss += gainLoss;
                totalCost += costBasis;
                
                if (gainLoss > 0) wins++;
                if (gainLoss < 0) losses++;
            });
            
            this.stats.totalTrades = portfolio.holdings.length;
            this.stats.totalReturn = totalGainLoss;
            this.stats.totalReturnPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
            this.stats.winRate = this.stats.totalTrades > 0 ? (wins / this.stats.totalTrades) * 100 : 0;
            this.stats.lastUpdated = Date.now();
            
            await this.save();
        }
    } catch (error) {
        console.error('[User] Error calculating stats:', error);
    }
};

module.exports = mongoose.model('User', UserSchema);