// server/models/Portfolio.js
const mongoose = require('mongoose');

// Define the Holding Schema (as a sub-document within Portfolio)
const HoldingSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    purchasePrice: { // Price at which the holding was bought per unit
        type: Number,
        required: true,
        min: 0
    },
    purchaseDate: {
        type: Date,
        default: Date.now // Or allow user to specify
    },
    // Optional: add currentPrice to denormalize or calculate on the fly
    // currentPrice: { type: Number, default: 0 },
    // currentValue: { type: Number, default: 0 },
    // profitLoss: { type: Number, default: 0 }
});

// Define the Portfolio Schema
const PortfolioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // Refers to the 'User' model
        required: true,
        unique: true // Each user has one portfolio
    },
    holdings: [HoldingSchema], // An array of Holding sub-documents
    // Optional: Denormalize total values for quick access (can be computed on the fly too)
    // totalValue: { type: Number, default: 0 },
    // totalProfitLoss: { type: Number, default: 0 },
    // totalProfitLossPercentage: { type: Number, default: 0 }
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
PortfolioSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Portfolio', PortfolioSchema);