// server/models/PaperTradingAccount.js
// Paper Trading Account Model with Leverage, Take Profit, Stop Loss Support

const mongoose = require('mongoose');

// Position schema with leverage + TP/SL support
const positionSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['stock', 'crypto'],
        required: true
    },
    positionType: {
        type: String,
        enum: ['long', 'short'],
        default: 'long'
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    averagePrice: {
        type: Number,
        required: true,
        min: 0
    },
    currentPrice: {
        type: Number,
        default: 0
    },
    // Leverage fields
    leverage: {
        type: Number,
        default: 1,
        min: 1,
        max: 20
    },
    leveragedValue: {
        type: Number,
        default: 0
    },
    liquidationPrice: {
        type: Number,
        default: null
    },
    isLiquidated: {
        type: Boolean,
        default: false
    },
    // Take Profit / Stop Loss
    takeProfit: {
        type: Number,
        default: null
    },
    stopLoss: {
        type: Number,
        default: null
    },
    // Trailing Stop (percentage based)
    trailingStopPercent: {
        type: Number,
        default: null,
        min: 0,
        max: 100
    },
    trailingStopPrice: {
        type: Number,
        default: null
    },
    highestPrice: {
        type: Number,
        default: null
    },
    lowestPrice: {
        type: Number,
        default: null
    },
    // Calculated fields
    profitLoss: {
        type: Number,
        default: 0
    },
    profitLossPercent: {
        type: Number,
        default: 0
    },
    // Timestamps
    openedAt: {
        type: Date,
        default: Date.now
    }
});

// Order history schema
const orderSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['stock', 'crypto'],
        required: true
    },
    side: {
        type: String,
        enum: ['buy', 'sell', 'cover'],
        required: true
    },
    positionType: {
        type: String,
        enum: ['long', 'short'],
        default: 'long'
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    // Leverage fields
    leverage: {
        type: Number,
        default: 1,
        min: 1,
        max: 20
    },
    leveragedValue: {
        type: Number,
        default: 0
    },
    // P&L for closing orders
    profitLoss: {
        type: Number,
        default: null
    },
    profitLossPercent: {
        type: Number,
        default: null
    },
    // How was this order triggered?
    triggerType: {
        type: String,
        enum: ['manual', 'take_profit', 'stop_loss', 'trailing_stop', 'liquidation'],
        default: 'manual'
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Alert schema
const alertSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['stock', 'crypto'],
        required: true
    },
    targetPrice: {
        type: Number,
        required: true
    },
    condition: {
        type: String,
        enum: ['above', 'below'],
        required: true
    },
    triggered: {
        type: Boolean,
        default: false
    },
    triggeredAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Main account schema
const paperTradingAccountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Balance tracking
    cashBalance: {
        type: Number,
        default: 100000
    },
    initialBalance: {
        type: Number,
        default: 100000
    },
    portfolioValue: {
        type: Number,
        default: 100000
    },
    // P&L tracking
    totalProfitLoss: {
        type: Number,
        default: 0
    },
    totalProfitLossPercent: {
        type: Number,
        default: 0
    },
    // Trade statistics
    totalTrades: {
        type: Number,
        default: 0
    },
    winningTrades: {
        type: Number,
        default: 0
    },
    losingTrades: {
        type: Number,
        default: 0
    },
    winRate: {
        type: Number,
        default: 0
    },
    // Streak tracking
    currentStreak: {
        type: Number,
        default: 0
    },
    bestStreak: {
        type: Number,
        default: 0
    },
    // Best/Worst trades
    biggestWin: {
        type: Number,
        default: 0
    },
    biggestLoss: {
        type: Number,
        default: 0
    },
    // TP/SL statistics
    takeProfitHits: {
        type: Number,
        default: 0
    },
    stopLossHits: {
        type: Number,
        default: 0
    },
    trailingStopHits: {
        type: Number,
        default: 0
    },
    liquidations: {
        type: Number,
        default: 0
    },
    // Refill tracking
    refillCount: {
        type: Number,
        default: 0
    },
    totalRefillAmount: {
        type: Number,
        default: 0
    },
    lastRefillDate: Date,
    // Arrays
    positions: [positionSchema],
    orders: [orderSchema],
    alerts: [alertSchema],
    // Timestamps
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
paperTradingAccountSchema.index({ user: 1 });
paperTradingAccountSchema.index({ 'positions.symbol': 1 });
paperTradingAccountSchema.index({ portfolioValue: -1 });
paperTradingAccountSchema.index({ totalProfitLossPercent: -1 });

module.exports = mongoose.model('PaperTradingAccount', paperTradingAccountSchema);