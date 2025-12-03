// server/models/VaultItem.js
const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['border', 'badge', 'feature', 'boost', 'cosmetic', 'utility'],
        required: true
    },
    category: {
        type: String,
        enum: ['feature', 'boost', 'cosmetic', 'utility'],
        default: 'cosmetic'
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary', 'mythic', 'origin'],
        default: 'common'
    },
    cost: {
        type: Number,
        default: 0,
        min: 0
    },
    price: {
        type: Number,
        default: 0,
        min: 0
    },
    icon: {
        type: String,
        default: null
    },
    color: {
        type: String,
        default: '#00adef'
    },
    // For borders
    borderStyle: {
        type: String,
        default: null
    },
    glowColor: {
        type: String,
        default: null
    },
    animation: {
        type: String,
        default: null
    },
    // For badges - unlock requirements
    unlockRequirement: {
        type: {
            type: String,
            enum: ['level', 'stats', 'special', 'founder', 'purchase'],
            default: 'purchase'
        },
        stat: String,
        value: mongoose.Schema.Types.Mixed
    },
    // Whether item can be obtained (false for founder-only items)
    obtainable: {
        type: Boolean,
        default: true
    },
    // Effect properties (for boosts/features)
    effectType: {
        type: String,
        enum: ['permanent', 'temporary', 'consumable', null],
        default: null
    },
    effectDuration: {
        type: Number,
        default: 0
    },
    effectValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    maxPurchases: {
        type: Number,
        default: 1
    },
    level: {
        type: Number,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    stock: {
        type: Number,
        default: -1
    }
}, {
    timestamps: true
});

// Index for faster queries
vaultItemSchema.index({ type: 1, rarity: 1 });
vaultItemSchema.index({ id: 1 });

module.exports = mongoose.model('VaultItem', vaultItemSchema);