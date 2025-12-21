// server/models/CopiedPrediction.js - Tracks individual copied predictions
// Links a copier's prediction to the original trader's prediction

const mongoose = require('mongoose');

const CopiedPredictionSchema = new mongoose.Schema({
    // The copy trade relationship
    copyTrade: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CopyTrade',
        required: true,
        index: true
    },

    // The user who copied (redundant but useful for queries)
    copier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // The original trader
    trader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // The original prediction that was copied
    originalPrediction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prediction',
        required: true,
        index: true
    },

    // The copier's prediction (may be same as original if shared, or new if created)
    copierPrediction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prediction',
        required: true,
        index: true
    },

    // Copy details at time of copy
    copyDetails: {
        symbol: { type: String, required: true },
        assetType: { type: String, enum: ['stock', 'crypto', 'dex'] },
        direction: { type: String, enum: ['UP', 'DOWN'] },
        entryPrice: { type: Number, required: true },
        targetPrice: { type: Number, required: true },
        confidence: { type: Number },
        signalStrength: { type: String },
        timeframe: { type: Number }
    },

    // Allocation used for this copy
    allocationDetails: {
        percentUsed: { type: Number },
        amountAllocated: { type: Number }, // Paper trading or real
        sharesOrUnits: { type: Number }
    },

    // Paper trade created from this copy (if applicable)
    paperTrade: {
        tradeId: { type: mongoose.Schema.Types.ObjectId },
        type: { type: String, enum: ['buy', 'sell'] },
        quantity: { type: Number },
        entryPrice: { type: Number },
        exitPrice: { type: Number },
        profitLoss: { type: Number },
        profitLossPercent: { type: Number }
    },

    // Status of this copied prediction
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled', 'failed'],
        default: 'pending',
        index: true
    },

    // Outcome
    outcome: {
        wasCorrect: { type: Boolean },
        profitLoss: { type: Number },
        profitLossPercent: { type: Number },
        closedAt: { type: Date },
        closeReason: { type: String } // 'target_hit', 'stop_loss', 'expired', 'manual'
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
    }
});

// Compound indexes
CopiedPredictionSchema.index({ copier: 1, status: 1 });
CopiedPredictionSchema.index({ trader: 1, createdAt: -1 });
CopiedPredictionSchema.index({ originalPrediction: 1, copier: 1 }, { unique: true });

// Update timestamp on save
CopiedPredictionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static: Get active copied predictions for a user
CopiedPredictionSchema.statics.getActiveCopies = async function(userId) {
    return this.find({
        copier: userId,
        status: { $in: ['pending', 'active'] }
    })
    .populate('trader', 'username profile.displayName profile.avatar')
    .populate('originalPrediction', 'symbol direction targetPrice confidence status')
    .sort({ createdAt: -1 });
};

// Static: Get copy history for a user
CopiedPredictionSchema.statics.getCopyHistory = async function(userId, limit = 50) {
    return this.find({
        copier: userId,
        status: { $in: ['completed', 'cancelled', 'failed'] }
    })
    .populate('trader', 'username profile.displayName profile.avatar')
    .populate('originalPrediction', 'symbol direction outcome')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static: Check if prediction was already copied by user
CopiedPredictionSchema.statics.alreadyCopied = async function(copierId, predictionId) {
    const exists = await this.findOne({
        copier: copierId,
        originalPrediction: predictionId
    });
    return !!exists;
};

// Static: Get stats for a copier
CopiedPredictionSchema.statics.getCopierStats = async function(userId) {
    const completed = await this.find({
        copier: userId,
        status: 'completed'
    });

    if (completed.length === 0) {
        return {
            totalCopies: 0,
            successRate: 0,
            totalProfitLoss: 0,
            avgProfitLossPercent: 0
        };
    }

    const successful = completed.filter(c => c.outcome?.wasCorrect);
    const totalPL = completed.reduce((sum, c) => sum + (c.outcome?.profitLoss || 0), 0);
    const avgPLPercent = completed.reduce((sum, c) => sum + (c.outcome?.profitLossPercent || 0), 0) / completed.length;

    return {
        totalCopies: completed.length,
        successRate: (successful.length / completed.length) * 100,
        totalProfitLoss: totalPL,
        avgProfitLossPercent: avgPLPercent
    };
};

module.exports = mongoose.model('CopiedPrediction', CopiedPredictionSchema);
