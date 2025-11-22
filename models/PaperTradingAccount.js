// server/models/PaperTradingAccount.js

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    type: { type: String, enum: ['stock', 'crypto'], required: true },
    quantity: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    currentPrice: { type: Number, default: 0 },
    profitLoss: { type: Number, default: 0 },
    profitLossPercent: { type: Number, default: 0 }
});

const orderSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    type: { type: String, enum: ['stock', 'crypto'], required: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    profitLoss: { type: Number, default: 0 },
    notes: { type: String },
    executedAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    type: { type: String, enum: ['stock', 'crypto'], required: true },
    targetPrice: { type: Number, required: true },
    condition: { type: String, enum: ['above', 'below'], required: true },
    triggered: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const paperTradingAccountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    initialBalance: {
        type: Number,
        default: 100000
    },
    cashBalance: {
        type: Number,
        default: 100000
    },
    portfolioValue: {
        type: Number,
        default: 100000
    },
    positions: [positionSchema],
    orders: [orderSchema],
    alerts: [alertSchema],
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    totalProfitLoss: { type: Number, default: 0 },
    totalProfitLossPercent: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 },
    biggestLoss: { type: Number, default: 0 },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PaperTradingAccount', paperTradingAccountSchema);