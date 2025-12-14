// server/models/Prediction.js - Track AI Predictions and Accuracy
// UPDATED: Flexible indicators schema + shared prediction tracking

const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        index: true
    },
    assetType: {
        type: String,
        enum: ['stock', 'crypto', 'dex'],
        default: 'stock'
    },
    // DEX token specific info
    dexInfo: {
        network: String,      // 'bsc', 'eth', 'solana', etc.
        poolAddress: String,  // GeckoTerminal pool address
        contractAddress: String // Token contract address
    },
    // Prediction data at time of creation
    currentPrice: {
        type: Number,
        required: true
    },
    targetPrice: {
        type: Number,
        required: true
    },
    direction: {
        type: String,
        enum: ['UP', 'DOWN', 'NEUTRAL'],
        required: true
    },
    // Signal strength from ML model
    signalStrength: {
        type: String,
        enum: ['strong', 'moderate', 'weak'],
        default: 'moderate'
    },
    isActionable: {
        type: Boolean,
        default: true
    },
    priceChange: {
        type: Number,
        required: true
    },
    priceChangePercent: {
        type: Number,
        required: true
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    timeframe: {
        type: Number, // Number of days
        required: true,
        default: 7
    },
    
    // ✅ FLEXIBLE INDICATORS SCHEMA - accepts any indicator format
    // Format: { "RSI": { value: 45.2, signal: "BUY" }, "MACD": { value: 1.5, signal: "SELL" }, ... }
    indicators: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Analysis message
    analysis: {
        trend: String,
        volatility: String,
        riskLevel: String,
        message: String
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    
    // Outcome tracking
    outcome: {
        actualPrice: Number,
        actualChange: Number,
        actualChangePercent: Number,
        wasCorrect: Boolean,
        accuracy: Number, // How close was the prediction (%)
        checkedAt: Date
    },
    status: {
        type: String,
        enum: ['pending', 'correct', 'incorrect', 'expired'],
        default: 'pending',
        index: true
    },
    
    // ✅ TTL CLEANUP: Set this field to auto-delete the document at that time
    // For invalid predictions, set to 24 hours from creation
    // For completed predictions, can optionally set to 30 days after expiry
    deleteAfter: {
        type: Date,
        default: null // null = never auto-delete
    },
    
    // ✅ SHARED PREDICTION TRACKING
    viewers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    viewCount: {
        type: Number,
        default: 1
    },
    
    // For social features
    isPublic: {
        type: Boolean,
        default: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likesCount: {
        type: Number,
        default: 0
    },
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
});

// Compound indexes for common queries
PredictionSchema.index({ user: 1, createdAt: -1 });
PredictionSchema.index({ symbol: 1, createdAt: -1 });
PredictionSchema.index({ status: 1, expiresAt: 1 });
PredictionSchema.index({ user: 1, status: 1 });
// ✅ NEW: Index for finding active shared predictions
PredictionSchema.index({ symbol: 1, status: 1, expiresAt: 1 });
PredictionSchema.index({ viewCount: -1, createdAt: -1 });

// ✅ TTL Index: Auto-delete expired predictions after 24 hours
// This will automatically remove documents where:
// - status is 'expired' AND deleteAfter has passed
PredictionSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });

// Method to check if prediction has expired
PredictionSchema.methods.isExpired = function() {
    return Date.now() > this.expiresAt;
};

// Method to calculate outcome
PredictionSchema.methods.calculateOutcome = async function(currentPrice) {
    if (this.status !== 'pending') {
        return; // Already checked
    }

    const actualChange = currentPrice - this.currentPrice;
    // Prevent division by zero
    const actualChangePercent = this.currentPrice > 0
        ? ((currentPrice - this.currentPrice) / this.currentPrice) * 100
        : 0;

    // Determine if prediction was correct
    let wasCorrect = false;
    if (this.direction === 'UP' && actualChange > 0) {
        wasCorrect = true;
    } else if (this.direction === 'DOWN' && actualChange < 0) {
        wasCorrect = true;
    }

    // Calculate accuracy (how close to the predicted price)
    // FIXED: Handle cases where price overshoots target (should be 100%+, not 0%)
    const targetMovement = this.targetPrice - this.currentPrice; // Expected movement
    const actualMovement = currentPrice - this.currentPrice;     // Actual movement
    
    let accuracy = 0;
    
    if (Math.abs(targetMovement) > 0) {
        if (this.direction === 'UP') {
            if (actualMovement >= targetMovement) {
                // Price met or exceeded target - 100% accurate (or more)
                accuracy = 100;
            } else if (actualMovement > 0) {
                // Moving in right direction but hasn't reached target
                accuracy = (actualMovement / targetMovement) * 100;
            } else {
                // Moving in wrong direction
                accuracy = 0;
            }
        } else if (this.direction === 'DOWN') {
            if (actualMovement <= targetMovement) {
                // Price met or exceeded target (went down more than expected)
                accuracy = 100;
            } else if (actualMovement < 0) {
                // Moving in right direction but hasn't reached target
                accuracy = (actualMovement / targetMovement) * 100;
            } else {
                // Moving in wrong direction
                accuracy = 0;
            }
        }
    }

    this.outcome = {
        actualPrice: currentPrice,
        actualChange,
        actualChangePercent,
        wasCorrect,
        accuracy: Math.round(Math.min(100, Math.max(0, accuracy)) * 100) / 100,
        checkedAt: Date.now()
    };

    this.status = wasCorrect ? 'correct' : 'incorrect';
    
    await this.save();
    return this.outcome;
};

// Static method to get user's prediction accuracy
PredictionSchema.statics.getUserAccuracy = async function(userId) {
    const predictions = await this.find({
        user: userId,
        status: { $in: ['correct', 'incorrect'] }
    });

    if (predictions.length === 0) {
        return {
            totalPredictions: 0,
            correctPredictions: 0,
            accuracy: 0,
            avgConfidence: 0
        };
    }

    const correctPredictions = predictions.filter(p => p.status === 'correct').length;
    const accuracy = (correctPredictions / predictions.length) * 100;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
        totalPredictions: predictions.length,
        correctPredictions,
        accuracy: Math.round(accuracy * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 100) / 100
    };
};

// Static method to get overall platform accuracy
// Only counts actionable predictions (excludes NEUTRAL and weak signals)
PredictionSchema.statics.getPlatformAccuracy = async function() {
    const predictions = await this.find({
        status: { $in: ['correct', 'incorrect'] },
        direction: { $in: ['UP', 'DOWN'] }, // Exclude NEUTRAL
        $or: [
            { isActionable: true },
            { isActionable: { $exists: false } } // Include old predictions without this field
        ]
    });

    if (predictions.length === 0) {
        return {
            totalPredictions: 0,
            correctPredictions: 0,
            accuracy: 0
        };
    }

    const correctPredictions = predictions.filter(p => p.status === 'correct').length;
    const accuracy = (correctPredictions / predictions.length) * 100;

    return {
        totalPredictions: predictions.length,
        correctPredictions,
        accuracy: Math.round(accuracy * 100) / 100
    };
};

// Static method to get trending predictions (most liked)
PredictionSchema.statics.getTrending = async function(limit = 10) {
    return this.find({ isPublic: true, status: 'pending' })
        .sort({ likesCount: -1, createdAt: -1 })
        .limit(limit)
        .populate('user', 'username profile.displayName profile.avatar');
};

// ✅ NEW: Get active shared predictions
PredictionSchema.statics.getActivePredictions = async function(limit = 20) {
    return this.find({ 
        status: 'pending',
        expiresAt: { $gt: new Date() }
    })
    .sort({ viewCount: -1, createdAt: -1 })
    .limit(limit)
    .populate('user', 'username profile.displayName profile.avatar');
};

// ✅ NEW: Find active prediction for symbol
PredictionSchema.statics.findActiveBySymbol = async function(symbol, timeframe = null) {
    const query = {
        symbol: symbol.toUpperCase(),
        status: 'pending',
        expiresAt: { $gt: new Date() }
    };
    
    if (timeframe) {
        query.timeframe = timeframe;
    }
    
    return this.findOne(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Prediction', PredictionSchema);