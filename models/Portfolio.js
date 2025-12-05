// server/models/Portfolio.js - OPTIMIZED VERSION

const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    purchasePrice: {
        type: Number,
        required: true,
        min: 0
    },
    currentPrice: {
        type: Number,
        default: 0
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    assetType: {
        type: String,
        enum: ['stock', 'crypto', 'etf', 'other'],
        default: 'stock'
    },
    // Performance tracking
    totalCost: {
        type: Number,
        default: function() {
            return this.quantity * this.purchasePrice;
        }
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
    }
}, { _id: true });

const PortfolioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    holdings: [HoldingSchema],
    cashBalance: {
        type: Number,
        default: 100000.00,
        min: 0
    },
    // Portfolio totals
    totalValue: {
        type: Number,
        default: 0
    },
    totalInvested: {
        type: Number,
        default: 0
    },
    totalChange: {
        type: Number,
        default: 0
    },
    totalChangePercent: {
        type: Number,
        default: 0
    },
    // Daily tracking
    dayChange: {
        type: Number,
        default: 0
    },
    dayChangePercent: {
        type: Number,
        default: 0
    },
    // Performance metrics
    allTimeHigh: {
        value: { type: Number, default: 0 },
        date: { type: Date }
    },
    allTimeLow: {
        value: { type: Number, default: 0 },
        date: { type: Date }
    },
    // Timestamps
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    },
    lastPriceUpdate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
PortfolioSchema.index({ user: 1, lastUpdatedAt: -1 });
PortfolioSchema.index({ totalValue: -1 }); // For leaderboards

// ============================================
// METHODS - Calculate Portfolio Stats
// ============================================

// Update a specific holding's current value and gain/loss
HoldingSchema.methods.updateValues = function() {
    this.currentValue = this.quantity * this.currentPrice;
    this.totalCost = this.quantity * this.purchasePrice;
    this.gainLoss = this.currentValue - this.totalCost;
    this.gainLossPercent = this.totalCost > 0 
        ? (this.gainLoss / this.totalCost) * 100 
        : 0;
};

// Calculate all portfolio totals
PortfolioSchema.methods.calculateTotals = function() {
    const startingBalance = 100000; // Starting paper trading balance (matches PaperTradingAccount)
    let totalInvested = 0;
    let currentValue = 0;

    // Update each holding and sum up values
    this.holdings.forEach(holding => {
        holding.updateValues();
        totalInvested += holding.totalCost;
        currentValue += holding.currentValue;
    });

    this.totalInvested = totalInvested;
    this.totalValue = currentValue + this.cashBalance;
    this.totalChange = this.totalValue - startingBalance;
    this.totalChangePercent = ((this.totalValue - startingBalance) / startingBalance) * 100;
    
    this.lastUpdatedAt = Date.now();

    // Update all-time high/low (with null safety)
    if (!this.allTimeHigh || !this.allTimeHigh.value || this.totalValue > this.allTimeHigh.value) {
        this.allTimeHigh = {
            value: this.totalValue,
            date: Date.now()
        };
    }

    if (!this.allTimeLow || !this.allTimeLow.value || this.totalValue < this.allTimeLow.value) {
        this.allTimeLow = {
            value: this.totalValue,
            date: Date.now()
        };
    }
};
// ============================================
// METHODS - Buy/Sell Assets
// ============================================

PortfolioSchema.methods.buyAsset = async function(symbol, quantity, price, assetType = 'stock') {
    const cost = quantity * price;

    if (cost > this.cashBalance) {
        throw new Error('Insufficient cash balance');
    }

    // Check if holding already exists
    const existingHolding = this.holdings.find(h => h.symbol === symbol.toUpperCase());

    if (existingHolding) {
        // Average down/up the purchase price
        const totalQuantity = existingHolding.quantity + quantity;
        const totalCost = (existingHolding.quantity * existingHolding.purchasePrice) + cost;
        
        existingHolding.purchasePrice = totalCost / totalQuantity;
        existingHolding.quantity = totalQuantity;
        existingHolding.currentPrice = price;
    } else {
        // Add new holding
        this.holdings.push({
            symbol: symbol.toUpperCase(),
            quantity,
            purchasePrice: price,
            currentPrice: price,
            purchaseDate: Date.now(),
            assetType
        });
    }

    this.cashBalance -= cost;
    this.calculateTotals();
    
    await this.save();
    return this;
};

PortfolioSchema.methods.sellAsset = async function(symbol, quantity, currentPrice) {
    const holding = this.holdings.find(h => h.symbol === symbol.toUpperCase());

    if (!holding) {
        throw new Error(`You don't own ${symbol}`);
    }

    if (holding.quantity < quantity) {
        throw new Error(`Insufficient quantity. You own ${holding.quantity} shares of ${symbol}`);
    }

    const saleProceeds = quantity * currentPrice;

    if (holding.quantity === quantity) {
        // Sell all - remove holding
        this.holdings = this.holdings.filter(h => h.symbol !== symbol.toUpperCase());
    } else {
        // Partial sale
        holding.quantity -= quantity;
        holding.currentPrice = currentPrice;
    }

    this.cashBalance += saleProceeds;
    this.calculateTotals();
    
    await this.save();
    return this;
};

// ============================================
// METHODS - Update Prices
// ============================================

PortfolioSchema.methods.updatePrices = async function(priceData) {
    // priceData format: { 'AAPL': 175.50, 'BTC': 43000, ... }

    let updated = false;

    this.holdings.forEach(holding => {
        // Fix: Check for undefined/null explicitly, not just falsy (0 is valid price)
        if (holding.symbol in priceData && priceData[holding.symbol] != null) {
            const newPrice = parseFloat(priceData[holding.symbol]);
            if (!isNaN(newPrice) && newPrice > 0) {
                holding.currentPrice = newPrice;
                updated = true;
                console.log(`[Portfolio] Updated ${holding.symbol}: $${newPrice.toFixed(2)}`);
            }
        }
    });

    if (updated) {
        this.calculateTotals();
        this.lastPriceUpdate = Date.now();
        await this.save();
        console.log(`[Portfolio] Total value updated: $${this.totalValue.toFixed(2)}`);
    }

    return this;
};

// ============================================
// METHODS - Get Portfolio Summary
// ============================================

PortfolioSchema.methods.getSummary = function() {
    return {
        totalValue: this.totalValue,
        totalInvested: this.totalInvested,
        cashBalance: this.cashBalance,
        totalChange: this.totalChange,
        totalChangePercent: this.totalChangePercent,
        holdingsCount: this.holdings.length,
        allTimeHigh: this.allTimeHigh,
        allTimeLow: this.allTimeLow,
        lastUpdated: this.lastUpdatedAt
    };
};

// Get holdings sorted by value
PortfolioSchema.methods.getTopHoldings = function(limit = 5) {
    return this.holdings
        .map(h => ({
            symbol: h.symbol,
            quantity: h.quantity,
            currentValue: h.currentValue,
            gainLoss: h.gainLoss,
            gainLossPercent: h.gainLossPercent,
            assetType: h.assetType
        }))
        .sort((a, b) => b.currentValue - a.currentValue)
        .slice(0, limit);
};

// Get best/worst performers
PortfolioSchema.methods.getPerformers = function() {
    const sorted = [...this.holdings].sort((a, b) => b.gainLossPercent - a.gainLossPercent);
    
    return {
        best: sorted.slice(0, 3).map(h => ({
            symbol: h.symbol,
            gainLossPercent: h.gainLossPercent,
            gainLoss: h.gainLoss
        })),
        worst: sorted.slice(-3).reverse().map(h => ({
            symbol: h.symbol,
            gainLossPercent: h.gainLossPercent,
            gainLoss: h.gainLoss
        }))
    };
};

// ============================================
// STATIC METHODS
// ============================================

// Get or create portfolio for user
PortfolioSchema.statics.getOrCreate = async function(userId) {
    let portfolio = await this.findOne({ user: userId });
    
    if (!portfolio) {
        portfolio = await this.create({
            user: userId,
            holdings: [],
            cashBalance: 100000.00
        });
    }
    
    return portfolio;
};

// Get leaderboard (top portfolios by value)
PortfolioSchema.statics.getLeaderboard = async function(limit = 10) {
    return this.find()
        .sort({ totalValue: -1 })
        .limit(limit)
        .populate('user', 'username profile.displayName profile.avatar')
        .select('user totalValue totalChangePercent lastUpdatedAt');
};

module.exports = mongoose.model('Portfolio', PortfolioSchema);