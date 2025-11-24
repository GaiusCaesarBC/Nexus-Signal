// server/models/PaperTradingAccount.js - COMPLETE WITH LONG/SHORT SUPPORT

const mongoose = require('mongoose');

// ============ POSITION SCHEMA ============
const positionSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['stock', 'crypto'],
        default: 'stock'
    },
    // ✅ Position Type: Long or Short
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
    totalCost: {
        type: Number,
        default: 0
    },
    profitLoss: {
        type: Number,
        default: 0
    },
    profitLossPercent: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// ✅ Calculate P/L with Long/Short support
positionSchema.methods.calculateProfitLoss = function() {
    if (this.positionType === 'short') {
        // Short: Profit when price DROPS
        // Entry: Sold at averagePrice, Exit: Buy back at currentPrice
        this.profitLoss = (this.averagePrice - this.currentPrice) * this.quantity;
    } else {
        // Long: Profit when price RISES (traditional)
        this.profitLoss = (this.currentPrice - this.averagePrice) * this.quantity;
    }
    
    this.profitLossPercent = (this.profitLoss / this.totalCost) * 100;
    this.lastUpdated = Date.now();
};

// ============ ORDER SCHEMA ============
const orderSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['stock', 'crypto'],
        default: 'stock'
    },
    // ✅ Position Type: Long or Short
    positionType: {
        type: String,
        enum: ['long', 'short'],
        default: 'long'
    },
    side: {
        type: String,
        enum: ['buy', 'sell'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    profitLoss: {
        type: Number,
        default: 0
    },
    profitLossPercent: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        maxlength: 500
    },
    executedAt: {
        type: Date,
        default: Date.now
    }
});

// ============ MAIN ACCOUNT SCHEMA ============
const paperTradingAccountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    startingBalance: {
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
    totalProfitLoss: {
        type: Number,
        default: 0
    },
    totalProfitLossPercent: {
        type: Number,
        default: 0
    },
    positions: [positionSchema],
    orders: [orderSchema],
    
    // Trading Stats
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
    bestStreak: {
        type: Number,
        default: 0
    },
    currentStreak: {
        type: Number,
        default: 0
    },
    biggestWin: {
        type: Number,
        default: 0
    },
    biggestLoss: {
        type: Number,
        default: 0
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
});

// ============ METHODS ============

// ✅ Calculate total portfolio value with Long/Short support
paperTradingAccountSchema.methods.calculatePortfolioValue = function() {
    let positionsValue = 0;
    
    for (const position of this.positions) {
        if (position.positionType === 'short') {
            // Short position value: Entry value + P/L
            // What we received when we shorted + current profit/loss
            positionsValue += position.totalCost + position.profitLoss;
        } else {
            // Long position value: Current market value
            positionsValue += position.currentPrice * position.quantity;
        }
    }
    
    this.portfolioValue = this.cashBalance + positionsValue;
    this.totalProfitLoss = this.portfolioValue - this.startingBalance;
    this.totalProfitLossPercent = ((this.portfolioValue - this.startingBalance) / this.startingBalance) * 100;
};

// Update win rate
paperTradingAccountSchema.methods.updateWinRate = function() {
    if (this.totalTrades > 0) {
        this.winRate = (this.winningTrades / this.totalTrades) * 100;
    } else {
        this.winRate = 0;
    }
};

// Update all positions with current prices
paperTradingAccountSchema.methods.updateAllPositions = function() {
    for (const position of this.positions) {
        position.calculateProfitLoss();
    }
    this.calculatePortfolioValue();
};

// Get position by symbol and type
paperTradingAccountSchema.methods.getPosition = function(symbol, type = 'stock', positionType = 'long') {
    return this.positions.find(
        p => p.symbol === symbol.toUpperCase() && 
             p.type === type &&
             p.positionType === positionType
    );
};

// Check if user has position
paperTradingAccountSchema.methods.hasPosition = function(symbol, type = 'stock', positionType = 'long') {
    return this.positions.some(
        p => p.symbol === symbol.toUpperCase() && 
             p.type === type &&
             p.positionType === positionType
    );
};

// Get total value of all positions
paperTradingAccountSchema.methods.getTotalPositionsValue = function() {
    let total = 0;
    for (const position of this.positions) {
        if (position.positionType === 'short') {
            total += position.totalCost + position.profitLoss;
        } else {
            total += position.currentPrice * position.quantity;
        }
    }
    return total;
};

// Get number of open positions
paperTradingAccountSchema.methods.getOpenPositionsCount = function() {
    return this.positions.length;
};

// Get recent orders
paperTradingAccountSchema.methods.getRecentOrders = function(limit = 10) {
    return this.orders.slice(0, limit);
};

// Reset account to starting balance
paperTradingAccountSchema.methods.reset = function() {
    this.cashBalance = this.startingBalance;
    this.portfolioValue = this.startingBalance;
    this.totalProfitLoss = 0;
    this.totalProfitLossPercent = 0;
    this.positions = [];
    this.orders = [];
    this.totalTrades = 0;
    this.winningTrades = 0;
    this.losingTrades = 0;
    this.winRate = 0;
    this.bestStreak = 0;
    this.currentStreak = 0;
    this.biggestWin = 0;
    this.biggestLoss = 0;
    this.lastActive = Date.now();
};

// ============ STATIC METHODS ============

// Get or create account for user
paperTradingAccountSchema.statics.getOrCreate = async function(userId) {
    let account = await this.findOne({ user: userId });
    
    if (!account) {
        account = new this({ user: userId });
        await account.save();
    }
    
    return account;
};

// Get leaderboard
paperTradingAccountSchema.statics.getLeaderboard = async function(limit = 10) {
    return this.find()
        .sort({ totalProfitLossPercent: -1 })
        .limit(limit)
        .populate('user', 'name email')
        .select('user portfolioValue totalProfitLoss totalProfitLossPercent totalTrades winRate');
};

// Get top performers
paperTradingAccountSchema.statics.getTopPerformers = async function(limit = 5) {
    return this.find({ totalTrades: { $gte: 5 } })
        .sort({ totalProfitLossPercent: -1 })
        .limit(limit)
        .populate('user', 'name email')
        .select('user totalProfitLossPercent winRate totalTrades');
};

// ============ INDEXES ============
paperTradingAccountSchema.index({ user: 1 });
paperTradingAccountSchema.index({ totalProfitLossPercent: -1 });
paperTradingAccountSchema.index({ portfolioValue: -1 });
paperTradingAccountSchema.index({ lastActive: -1 });

// ============ VIRTUALS ============

// Get buying power (cash available to trade)
paperTradingAccountSchema.virtual('buyingPower').get(function() {
    return this.cashBalance;
});

// Get total invested amount
paperTradingAccountSchema.virtual('totalInvested').get(function() {
    let total = 0;
    for (const position of this.positions) {
        total += position.totalCost;
    }
    return total;
});

// Get profit percentage
paperTradingAccountSchema.virtual('profitPercent').get(function() {
    if (this.startingBalance === 0) return 0;
    return ((this.portfolioValue - this.startingBalance) / this.startingBalance) * 100;
});

// ============ PRE-SAVE HOOKS ============

paperTradingAccountSchema.pre('save', function(next) {
    // Update lastActive timestamp
    this.lastActive = Date.now();
    
    // Ensure calculations are up to date
    this.calculatePortfolioValue();
    this.updateWinRate();
    
    next();
});

// ============ EXPORT ============
module.exports = mongoose.model('PaperTradingAccount', paperTradingAccountSchema);