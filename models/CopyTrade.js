// server/models/CopyTrade.js - Copy Trading Relationship Model
// Tracks who is copying whom and their copy trading settings

const mongoose = require('mongoose');

const CopyTradeSchema = new mongoose.Schema({
    // The user who is copying (the copier/follower)
    copier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // The user being copied (the trader/leader)
    trader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Copy trading settings
    settings: {
        // Allocation per trade (percentage of copier's available balance)
        allocationPercent: {
            type: Number,
            default: 10,
            min: 1,
            max: 100
        },

        // Maximum dollar amount per copied trade
        maxAmountPerTrade: {
            type: Number,
            default: 1000
        },

        // Maximum number of active copied positions
        maxActiveTrades: {
            type: Number,
            default: 10
        },

        // Asset types to copy
        copyAssetTypes: {
            stocks: { type: Boolean, default: true },
            crypto: { type: Boolean, default: true },
            dex: { type: Boolean, default: false }
        },

        // Only copy predictions with minimum confidence
        minConfidence: {
            type: Number,
            default: 60,
            min: 0,
            max: 100
        },

        // Only copy "strong" or "moderate" signals (exclude "weak")
        minSignalStrength: {
            type: String,
            enum: ['weak', 'moderate', 'strong'],
            default: 'moderate'
        },

        // Copy both directions or only one
        copyDirections: {
            up: { type: Boolean, default: true },
            down: { type: Boolean, default: true }
        },

        // Enable stop-loss on copied trades
        enableStopLoss: {
            type: Boolean,
            default: true
        },
        stopLossPercent: {
            type: Number,
            default: 10, // -10%
            min: 1,
            max: 50
        },

        // Enable take-profit on copied trades
        enableTakeProfit: {
            type: Boolean,
            default: false
        },
        takeProfitPercent: {
            type: Number,
            default: 20, // +20%
            min: 1,
            max: 200
        },

        // Notify on copied trades
        notifyOnCopy: {
            type: Boolean,
            default: true
        }
    },

    // Statistics
    stats: {
        totalCopiedTrades: { type: Number, default: 0 },
        successfulTrades: { type: Number, default: 0 },
        failedTrades: { type: Number, default: 0 },
        totalProfitLoss: { type: Number, default: 0 },
        totalProfitLossPercent: { type: Number, default: 0 },
        lastCopiedAt: { type: Date, default: null }
    },

    // Status
    status: {
        type: String,
        enum: ['active', 'paused', 'stopped'],
        default: 'active',
        index: true
    },

    // Reason if stopped/paused
    statusReason: {
        type: String,
        default: null
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    pausedAt: {
        type: Date,
        default: null
    },
    stoppedAt: {
        type: Date,
        default: null
    }
});

// Compound indexes
CopyTradeSchema.index({ copier: 1, trader: 1 }, { unique: true });
CopyTradeSchema.index({ trader: 1, status: 1 });
CopyTradeSchema.index({ copier: 1, status: 1 });

// Update timestamp on save
CopyTradeSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static method: Get all traders a user is copying
CopyTradeSchema.statics.getCopiedTraders = async function(userId) {
    return this.find({
        copier: userId,
        status: { $in: ['active', 'paused'] }
    })
    .populate('trader', 'username profile.displayName profile.avatar stats.winRate stats.totalTrades gamification.level')
    .sort({ createdAt: -1 });
};

// Static method: Get all users copying a trader
CopyTradeSchema.statics.getCopiers = async function(traderId) {
    return this.find({
        trader: traderId,
        status: 'active'
    })
    .populate('copier', 'username profile.displayName profile.avatar')
    .sort({ createdAt: -1 });
};

// Static method: Check if user is copying a trader
CopyTradeSchema.statics.isCopying = async function(copierId, traderId) {
    const copyTrade = await this.findOne({
        copier: copierId,
        trader: traderId,
        status: { $in: ['active', 'paused'] }
    });
    return !!copyTrade;
};

// Static method: Get copy trade relationship
CopyTradeSchema.statics.getCopyRelationship = async function(copierId, traderId) {
    return this.findOne({
        copier: copierId,
        trader: traderId
    });
};

// Method: Pause copy trading
CopyTradeSchema.methods.pause = async function(reason = 'Manual pause') {
    this.status = 'paused';
    this.statusReason = reason;
    this.pausedAt = new Date();
    await this.save();
};

// Method: Resume copy trading
CopyTradeSchema.methods.resume = async function() {
    this.status = 'active';
    this.statusReason = null;
    this.pausedAt = null;
    await this.save();
};

// Method: Stop copy trading
CopyTradeSchema.methods.stop = async function(reason = 'Manual stop') {
    this.status = 'stopped';
    this.statusReason = reason;
    this.stoppedAt = new Date();
    await this.save();
};

// Method: Update stats after a copied trade completes
CopyTradeSchema.methods.updateStats = async function(profitLoss, profitLossPercent, wasSuccessful) {
    this.stats.totalCopiedTrades += 1;
    if (wasSuccessful) {
        this.stats.successfulTrades += 1;
    } else {
        this.stats.failedTrades += 1;
    }
    this.stats.totalProfitLoss += profitLoss;

    // Calculate running average P/L %
    const totalTrades = this.stats.totalCopiedTrades;
    this.stats.totalProfitLossPercent =
        ((this.stats.totalProfitLossPercent * (totalTrades - 1)) + profitLossPercent) / totalTrades;

    this.stats.lastCopiedAt = new Date();
    await this.save();
};

// Virtual for win rate
CopyTradeSchema.virtual('winRate').get(function() {
    if (this.stats.totalCopiedTrades === 0) return 0;
    return (this.stats.successfulTrades / this.stats.totalCopiedTrades) * 100;
});

module.exports = mongoose.model('CopyTrade', CopyTradeSchema);
