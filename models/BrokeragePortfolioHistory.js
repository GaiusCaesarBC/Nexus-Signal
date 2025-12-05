// server/models/BrokeragePortfolioHistory.js
// Tracks real brokerage portfolio value over time for gain/loss calculation

const mongoose = require('mongoose');

const SnapshotSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: true
    },
    holdingsCount: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const BrokeragePortfolioHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    // Initial value when user first connected a brokerage
    initialValue: {
        type: Number,
        required: true,
        default: 0
    },
    initialDate: {
        type: Date,
        default: Date.now
    },
    // Current/latest tracked value
    currentValue: {
        type: Number,
        default: 0
    },
    // Calculated gain/loss
    totalGain: {
        type: Number,
        default: 0
    },
    totalGainPercent: {
        type: Number,
        default: 0
    },
    // All-time high/low
    allTimeHigh: {
        value: { type: Number, default: 0 },
        date: { type: Date }
    },
    allTimeLow: {
        value: { type: Number, default: null },
        date: { type: Date }
    },
    // Historical snapshots (keep last 90 days)
    snapshots: [SnapshotSchema],
    // Last update
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Calculate gain/loss
BrokeragePortfolioHistorySchema.methods.calculateGainLoss = function() {
    if (this.initialValue > 0) {
        this.totalGain = this.currentValue - this.initialValue;
        this.totalGainPercent = ((this.currentValue - this.initialValue) / this.initialValue) * 100;
    } else {
        this.totalGain = 0;
        this.totalGainPercent = 0;
    }
};

// Update current value and recalculate
BrokeragePortfolioHistorySchema.methods.updateValue = async function(newValue, holdingsCount = 0) {
    this.currentValue = newValue;
    this.calculateGainLoss();
    this.lastUpdated = new Date();

    // Update all-time high
    if (!this.allTimeHigh.value || newValue > this.allTimeHigh.value) {
        this.allTimeHigh = { value: newValue, date: new Date() };
    }

    // Update all-time low (only if we have a value)
    if (this.allTimeLow.value === null || newValue < this.allTimeLow.value) {
        this.allTimeLow = { value: newValue, date: new Date() };
    }

    // Add snapshot (limit to one per hour to avoid too many entries)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSnapshot = this.snapshots.find(s => s.timestamp > oneHourAgo);

    if (!recentSnapshot) {
        this.snapshots.push({
            value: newValue,
            holdingsCount,
            timestamp: new Date()
        });

        // Keep only last 90 days of snapshots
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        this.snapshots = this.snapshots.filter(s => s.timestamp > ninetyDaysAgo);
    }

    await this.save();
    return this;
};

// Get summary for frontend
BrokeragePortfolioHistorySchema.methods.getSummary = function() {
    return {
        initialValue: this.initialValue,
        initialDate: this.initialDate,
        currentValue: this.currentValue,
        totalGain: this.totalGain,
        totalGainPercent: this.totalGainPercent,
        allTimeHigh: this.allTimeHigh,
        allTimeLow: this.allTimeLow,
        lastUpdated: this.lastUpdated
    };
};

// Static: Get or create history for user
BrokeragePortfolioHistorySchema.statics.getOrCreate = async function(userId, initialValue = 0) {
    let history = await this.findOne({ user: userId });

    if (!history) {
        history = await this.create({
            user: userId,
            initialValue: initialValue,
            currentValue: initialValue,
            initialDate: new Date(),
            allTimeHigh: { value: initialValue, date: new Date() },
            allTimeLow: { value: initialValue, date: new Date() }
        });
        console.log(`[PortfolioHistory] Created new history for user ${userId} with initial value $${initialValue}`);
    }

    return history;
};

// Static: Update or create with new value
BrokeragePortfolioHistorySchema.statics.trackValue = async function(userId, newValue, holdingsCount = 0) {
    let history = await this.findOne({ user: userId });

    if (!history) {
        // First time tracking - set initial value
        history = await this.create({
            user: userId,
            initialValue: newValue,
            currentValue: newValue,
            initialDate: new Date(),
            allTimeHigh: { value: newValue, date: new Date() },
            allTimeLow: { value: newValue, date: new Date() }
        });
        console.log(`[PortfolioHistory] Created new history for user ${userId} with initial value $${newValue.toFixed(2)}`);
    } else {
        await history.updateValue(newValue, holdingsCount);
        console.log(`[PortfolioHistory] Updated user ${userId}: $${newValue.toFixed(2)} (${history.totalGainPercent >= 0 ? '+' : ''}${history.totalGainPercent.toFixed(2)}%)`);
    }

    return history;
};

module.exports = mongoose.model('BrokeragePortfolioHistory', BrokeragePortfolioHistorySchema);
