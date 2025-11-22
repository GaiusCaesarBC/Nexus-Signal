// server/models/Prediction.js - Track AI Predictions and Accuracy

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
        enum: ['stock', 'crypto'],
        default: 'stock'
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
        enum: ['UP', 'DOWN'],
        required: true
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
    // Technical indicators at time of prediction
    indicators: {
        rsi: Number,
        macd: {
            macd: Number,
            signal: Number,
            histogram: Number
        },
        bollingerBands: {
            upper: Number,
            mid: Number,
            lower: Number
        },
        sma50: Number,
        sma200: Number,
        avgVolume: Number
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
    const actualChangePercent = ((currentPrice - this.currentPrice) / this.currentPrice) * 100;

    // Determine if prediction was correct
    let wasCorrect = false;
    if (this.direction === 'UP' && actualChange > 0) {
        wasCorrect = true;
    } else if (this.direction === 'DOWN' && actualChange < 0) {
        wasCorrect = true;
    }

    // Calculate accuracy (how close to the predicted price)
    const priceDifference = Math.abs(currentPrice - this.targetPrice);
    const maxDifference = Math.abs(this.targetPrice - this.currentPrice);
    const accuracy = maxDifference > 0 
        ? Math.max(0, 100 - (priceDifference / maxDifference) * 100)
        : 0;

    this.outcome = {
        actualPrice: currentPrice,
        actualChange,
        actualChangePercent,
        wasCorrect,
        accuracy: Math.round(accuracy * 100) / 100,
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
PredictionSchema.statics.getPlatformAccuracy = async function() {
    const predictions = await this.find({
        status: { $in: ['correct', 'incorrect'] }
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

module.exports = mongoose.model('Prediction', PredictionSchema);