// server/models/Backtest.js - Track Backtesting Results
const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    type: { type: String, enum: ['buy', 'sell'], required: true },
    price: { type: Number, required: true },
    shares: { type: Number, required: true },
    value: { type: Number, required: true },
    signal: String,
    profit: Number,
    profitPercent: Number,
    portfolioValue: Number
});

const BacktestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        default: function() {
            return `${this.strategy} - ${this.symbol}`;
        }
    },
    strategy: {
        type: String,
        required: true,
        enum: ['ma-crossover', 'rsi-reversal', 'breakout', 'mean-reversion', 'macd-crossover', 'bollinger-bands']
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    assetType: {
        type: String,
        enum: ['stock', 'crypto'],
        default: 'stock'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    initialCapital: {
        type: Number,
        required: true,
        default: 10000
    },
    parameters: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    error: String,

    // Results
    results: {
        finalValue: Number,
        totalReturn: Number,
        totalReturnPercent: Number,
        annualizedReturn: Number,
        sharpeRatio: Number,
        sortinoRatio: Number,
        maxDrawdown: Number,
        maxDrawdownPercent: Number,
        winRate: Number,
        totalTrades: Number,
        profitableTrades: Number,
        losingTrades: Number,
        averageWin: Number,
        averageLoss: Number,
        largestWin: Number,
        largestLoss: Number,
        profitFactor: Number,
        averageHoldingPeriod: Number,
        volatility: Number,
        calmarRatio: Number
    },

    // Trade history
    trades: [TradeSchema],

    // Monthly performance breakdown
    monthlyPerformance: [{
        month: String,
        year: Number,
        return: Number,
        trades: Number,
        winRate: Number
    }],

    // Equity curve data points (for charting)
    equityCurve: [{
        date: Date,
        value: Number,
        benchmark: Number
    }],

    // Benchmark comparison
    benchmark: {
        symbol: { type: String, default: 'SPY' },
        return: Number,
        sharpeRatio: Number
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    processingTime: Number // in milliseconds
});

// Indexes
BacktestSchema.index({ user: 1, createdAt: -1 });
BacktestSchema.index({ user: 1, status: 1 });
BacktestSchema.index({ symbol: 1, strategy: 1 });

// Virtual for duration
BacktestSchema.virtual('duration').get(function() {
    if (!this.startDate || !this.endDate) return 0;
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Method to mark as completed
BacktestSchema.methods.complete = async function(results, trades, equityCurve, monthlyPerformance) {
    this.status = 'completed';
    this.results = results;
    this.trades = trades;
    this.equityCurve = equityCurve;
    this.monthlyPerformance = monthlyPerformance;
    this.completedAt = new Date();
    this.processingTime = Date.now() - this.createdAt.getTime();
    await this.save();
    return this;
};

// Method to mark as failed
BacktestSchema.methods.fail = async function(error) {
    this.status = 'failed';
    this.error = error;
    this.completedAt = new Date();
    await this.save();
    return this;
};

// Static: Get user's backtests
BacktestSchema.statics.getUserBacktests = async function(userId, limit = 20) {
    return this.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('-trades -equityCurve'); // Exclude large arrays for list view
};

// Static: Get best performing strategies
BacktestSchema.statics.getBestStrategies = async function(userId) {
    return this.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId), status: 'completed' } },
        { $group: {
            _id: '$strategy',
            avgReturn: { $avg: '$results.totalReturnPercent' },
            avgSharpe: { $avg: '$results.sharpeRatio' },
            avgWinRate: { $avg: '$results.winRate' },
            count: { $sum: 1 }
        }},
        { $sort: { avgReturn: -1 } }
    ]);
};

module.exports = mongoose.model('Backtest', BacktestSchema);
