// server/models/Trade.js - Trading Journal Model

const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['long', 'short'],
        required: true
    },
    entry: {
        type: Number,
        required: true
    },
    exit: {
        type: Number,
        required: true
    },
    shares: {
        type: Number,
        required: true
    },
    profit: {
        type: Number,
        required: true
    },
    profitPercent: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    strategy: {
        type: String,
        default: ''
    },
    emotion: {
        type: String,
        enum: ['confident', 'nervous', 'neutral', 'excited'],
        default: 'neutral'
    },
    notes: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
TradeSchema.index({ user: 1, date: -1 });
TradeSchema.index({ user: 1, symbol: 1 });

module.exports = mongoose.model('Trade', TradeSchema);