// server/models/ManualHolding.js - Manual Portfolio Holdings Model
const mongoose = require('mongoose');

const manualHoldingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    connection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrokerageConnection',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        default: ''
    },
    assetType: {
        type: String,
        enum: ['stock', 'crypto', 'etf', 'other'],
        default: 'stock'
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    costBasis: {
        type: Number,
        required: true,
        min: 0
    },
    currentPrice: {
        type: Number,
        default: 0
    },
    currentValue: {
        type: Number,
        default: 0
    },
    gainLoss: {
        type: Number,
        default: 0
    },
    gainLossPercent: {
        type: Number,
        default: 0
    },
    dateAdded: {
        type: Date,
        default: Date.now
    },
    lastPriceUpdate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

manualHoldingSchema.index({ user: 1, connection: 1 });
manualHoldingSchema.index({ user: 1, symbol: 1 });

// Recalculate derived fields from current price
manualHoldingSchema.methods.updatePrice = function(price) {
    this.currentPrice = price;
    this.currentValue = this.quantity * price;
    const totalCost = this.quantity * this.costBasis;
    this.gainLoss = this.currentValue - totalCost;
    this.gainLossPercent = totalCost > 0 ? ((this.currentValue - totalCost) / totalCost) * 100 : 0;
    this.lastPriceUpdate = new Date();
};

// Get all holdings for a user's manual connection
manualHoldingSchema.statics.getByConnection = async function(connectionId) {
    return this.find({ connection: connectionId }).sort({ currentValue: -1 });
};

// Get all manual holdings for a user
manualHoldingSchema.statics.getByUser = async function(userId) {
    return this.find({ user: userId }).sort({ currentValue: -1 });
};

module.exports = mongoose.model('ManualHolding', manualHoldingSchema);
