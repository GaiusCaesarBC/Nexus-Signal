// server/models/Alert.js - Price Alert Model

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Alert type
    type: {
        type: String,
        enum: ['price_above', 'price_below', 'percent_change', 'prediction_expiry', 'portfolio_value'],
        required: true
    },
    
    // Asset information
    symbol: {
        type: String,
        required: function() {
            return ['price_above', 'price_below', 'percent_change'].includes(this.type);
        },
        uppercase: true
    },
    
    assetType: {
        type: String,
        enum: ['stock', 'crypto'],
        default: 'stock'
    },
    
    // Alert conditions
    targetPrice: {
        type: Number,
        required: function() {
            return ['price_above', 'price_below'].includes(this.type);
        }
    },
    
    percentChange: {
        type: Number,
        required: function() {
            return this.type === 'percent_change';
        }
    },
    
    timeframe: {
        type: String,
        enum: ['1h', '24h', '7d', '30d'],
        default: '24h'
    },
    
    // Portfolio alerts
    portfolioThreshold: {
        type: Number,
        required: function() {
            return this.type === 'portfolio_value';
        }
    },
    
    // Prediction reference
    prediction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prediction',
        required: function() {
            return this.type === 'prediction_expiry';
        }
    },
    
    // Alert status
    status: {
        type: String,
        enum: ['active', 'triggered', 'expired', 'cancelled'],
        default: 'active',
        index: true
    },
    
    // Notification settings
    notifyVia: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        push: { type: Boolean, default: false }
    },
    
    // Alert metadata
    currentPrice: {
        type: Number
    },
    
    triggeredAt: {
        type: Date
    },
    
    triggeredPrice: {
        type: Number
    },
    
    expiresAt: {
        type: Date,
        default: function() {
            // Alerts expire after 30 days by default
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    },
    
    // One-time or recurring
    recurring: {
        type: Boolean,
        default: false
    },
    
    // Message
    customMessage: {
        type: String,
        maxlength: 200
    },
    
    // Metadata
    lastChecked: {
        type: Date
    },
    
    checkCount: {
        type: Number,
        default: 0
    }
    
}, {
    timestamps: true
});

// Indexes for efficient queries
alertSchema.index({ user: 1, status: 1 });
alertSchema.index({ status: 1, type: 1 });
alertSchema.index({ symbol: 1, status: 1 });
alertSchema.index({ triggeredAt: 1 });
alertSchema.index({ expiresAt: 1 });

// Virtual for formatted message
alertSchema.virtual('message').get(function() {
    if (this.customMessage) return this.customMessage;
    
    switch (this.type) {
        case 'price_above':
            return `${this.symbol} is above $${this.targetPrice}`;
        case 'price_below':
            return `${this.symbol} is below $${this.targetPrice}`;
        case 'percent_change':
            return `${this.symbol} changed ${this.percentChange > 0 ? '+' : ''}${this.percentChange}% in ${this.timeframe}`;
        case 'prediction_expiry':
            return `Your prediction is about to expire`;
        case 'portfolio_value':
            return `Portfolio value reached $${this.portfolioThreshold}`;
        default:
            return 'Alert triggered';
    }
});

// Method to check if alert condition is met
alertSchema.methods.checkCondition = function(currentPrice, previousPrice) {
    this.lastChecked = new Date();
    this.checkCount += 1;
    this.currentPrice = currentPrice;
    
    let triggered = false;
    
    switch (this.type) {
        case 'price_above':
            triggered = currentPrice >= this.targetPrice;
            break;
            
        case 'price_below':
            triggered = currentPrice <= this.targetPrice;
            break;
            
        case 'percent_change':
            if (previousPrice) {
                const change = ((currentPrice - previousPrice) / previousPrice) * 100;
                triggered = Math.abs(change) >= Math.abs(this.percentChange);
            }
            break;
            
        case 'prediction_expiry':
            // Checked separately in prediction checker
            break;
            
        case 'portfolio_value':
            // Checked separately in portfolio checker
            break;
    }
    
    if (triggered) {
        this.status = 'triggered';
        this.triggeredAt = new Date();
        this.triggeredPrice = currentPrice;
    }
    
    return triggered;
};

// Static method to get active alerts for a user
alertSchema.statics.getActiveAlerts = function(userId) {
    return this.find({
        user: userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// Static method to get triggered alerts for a user
alertSchema.statics.getTriggeredAlerts = function(userId, limit = 50) {
    return this.find({
        user: userId,
        status: 'triggered'
    })
    .sort({ triggeredAt: -1 })
    .limit(limit);
};

// Static method to get alerts by symbol
alertSchema.statics.getAlertsBySymbol = function(symbol) {
    return this.find({
        symbol: symbol.toUpperCase(),
        status: 'active',
        expiresAt: { $gt: new Date() }
    });
};

// Middleware to auto-expire old alerts
alertSchema.pre('save', function(next) {
    if (this.expiresAt && this.expiresAt < new Date() && this.status === 'active') {
        this.status = 'expired';
    }
    next();
});

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;