// server/models/Portfolio.js - CORRECTED VERSION

const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    quantity: {  // ✅ ONLY quantity, NOT shares
        type: Number,
        required: true,
        min: 0
    },
    purchasePrice: {  // ✅ ONLY purchasePrice, NOT averagePrice
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
    }
}, { _id: true });

const PortfolioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    holdings: [HoldingSchema],
    cashBalance: {
        type: Number,
        default: 10000.00
    },
    totalValue: {
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
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Portfolio', PortfolioSchema);