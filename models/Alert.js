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
        enum: [
            // Price alerts
            'price_above', 'price_below', 'percent_change',
            // System alerts
            'prediction_expiry', 'portfolio_value',
            // Technical indicator alerts
            'rsi_oversold', 'rsi_overbought',
            'macd_bullish_crossover', 'macd_bearish_crossover',
            'bollinger_upper_breakout', 'bollinger_lower_breakout',
            // Support/Resistance alerts
            'support_test', 'resistance_test'
        ],
        required: true
    },
    
    // Asset information
    symbol: {
        type: String,
        required: function() {
            // All price and technical alerts require a symbol
            const symbolRequiredTypes = [
                'price_above', 'price_below', 'percent_change',
                'rsi_oversold', 'rsi_overbought',
                'macd_bullish_crossover', 'macd_bearish_crossover',
                'bollinger_upper_breakout', 'bollinger_lower_breakout',
                'support_test', 'resistance_test'
            ];
            return symbolRequiredTypes.includes(this.type);
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
    },

    // Technical alert parameters
    technicalParams: {
        // RSI thresholds
        rsiThreshold: {
            type: Number,
            default: function() {
                if (this.type === 'rsi_oversold') return 30;
                if (this.type === 'rsi_overbought') return 70;
                return null;
            }
        },
        // Support/Resistance levels
        supportLevel: { type: Number },
        resistanceLevel: { type: Number },
        // Tolerance for level tests (percentage)
        tolerance: { type: Number, default: 2 },
        // Store last indicator values for crossover detection
        lastRsi: { type: Number },
        lastMacdLine: { type: Number },
        lastMacdSignal: { type: Number },
        lastBollingerUpper: { type: Number },
        lastBollingerLower: { type: Number }
    },

    // Technical alert trigger data (populated when triggered)
    technicalTriggerData: {
        indicatorValue: { type: Number },
        indicatorName: { type: String },
        signalDescription: { type: String }
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

    const threshold = this.technicalParams?.rsiThreshold;
    const support = this.technicalParams?.supportLevel;
    const resistance = this.technicalParams?.resistanceLevel;
    const triggerValue = this.technicalTriggerData?.indicatorValue;

    switch (this.type) {
        // Price alerts
        case 'price_above':
            return `${this.symbol} is above $${this.targetPrice}`;
        case 'price_below':
            return `${this.symbol} is below $${this.targetPrice}`;
        case 'percent_change':
            return `${this.symbol} changed ${this.percentChange > 0 ? '+' : ''}${this.percentChange}% in ${this.timeframe}`;

        // System alerts
        case 'prediction_expiry':
            return `Your prediction is about to expire`;
        case 'portfolio_value':
            return `Portfolio value reached $${this.portfolioThreshold}`;

        // RSI alerts
        case 'rsi_oversold':
            return `${this.symbol} RSI dropped below ${threshold || 30}${triggerValue ? ` (Current: ${triggerValue.toFixed(1)})` : ''} - Oversold`;
        case 'rsi_overbought':
            return `${this.symbol} RSI rose above ${threshold || 70}${triggerValue ? ` (Current: ${triggerValue.toFixed(1)})` : ''} - Overbought`;

        // MACD alerts
        case 'macd_bullish_crossover':
            return `${this.symbol} MACD bullish crossover detected - Momentum shifting up`;
        case 'macd_bearish_crossover':
            return `${this.symbol} MACD bearish crossover detected - Momentum shifting down`;

        // Bollinger alerts
        case 'bollinger_upper_breakout':
            return `${this.symbol} broke above upper Bollinger Band - Potential breakout`;
        case 'bollinger_lower_breakout':
            return `${this.symbol} broke below lower Bollinger Band - Potential breakdown`;

        // Support/Resistance alerts
        case 'support_test':
            return `${this.symbol} testing support at $${support?.toFixed(2) || 'N/A'}`;
        case 'resistance_test':
            return `${this.symbol} testing resistance at $${resistance?.toFixed(2) || 'N/A'}`;

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

// Static method to get active technical alerts (for technical checker)
alertSchema.statics.getActiveTechnicalAlerts = function() {
    const technicalTypes = [
        'rsi_oversold', 'rsi_overbought',
        'macd_bullish_crossover', 'macd_bearish_crossover',
        'bollinger_upper_breakout', 'bollinger_lower_breakout',
        'support_test', 'resistance_test'
    ];

    return this.find({
        type: { $in: technicalTypes },
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).sort({ symbol: 1 });
};

// Helper to check if this is a technical alert type
alertSchema.methods.isTechnicalAlert = function() {
    const technicalTypes = [
        'rsi_oversold', 'rsi_overbought',
        'macd_bullish_crossover', 'macd_bearish_crossover',
        'bollinger_upper_breakout', 'bollinger_lower_breakout',
        'support_test', 'resistance_test'
    ];
    return technicalTypes.includes(this.type);
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