// server/models/VaultItem.js
const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['feature', 'boost', 'cosmetic', 'utility'],
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    icon: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: '#00adef'
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    effectType: {
        type: String,
        enum: ['permanent', 'temporary', 'consumable'],
        required: true
    },
    effectDuration: {
        type: Number, // in hours for temporary items
        default: 0
    },
    effectValue: {
        type: mongoose.Schema.Types.Mixed, // flexible for different effect types
        default: null
    },
    maxPurchases: {
        type: Number,
        default: 1 // how many times can be purchased
    },
    level: {
        type: Number,
        default: 1 // minimum level required
    },
    isActive: {
        type: Boolean,
        default: true
    },
    stock: {
        type: Number,
        default: -1 // -1 = unlimited
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('VaultItem', vaultItemSchema);