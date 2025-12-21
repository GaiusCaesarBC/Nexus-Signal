// server/models/PushSubscription.js - Web Push Subscription Storage
const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Push subscription object from browser
    subscription: {
        endpoint: {
            type: String,
            required: true
        },
        keys: {
            p256dh: {
                type: String,
                required: true
            },
            auth: {
                type: String,
                required: true
            }
        }
    },

    // Device/browser info for management
    deviceInfo: {
        userAgent: String,
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown'],
            default: 'unknown'
        },
        browser: String,
        os: String
    },

    // Notification preferences
    preferences: {
        predictions: { type: Boolean, default: true },      // Prediction outcomes
        priceAlerts: { type: Boolean, default: true },      // Price alerts
        copyTrading: { type: Boolean, default: true },      // Copy trade events
        social: { type: Boolean, default: true },           // Likes, comments, follows
        achievements: { type: Boolean, default: true },     // Achievements & level ups
        system: { type: Boolean, default: true },           // System announcements
        marketing: { type: Boolean, default: false }        // Marketing/promo (opt-in)
    },

    // Status tracking
    active: {
        type: Boolean,
        default: true
    },

    // Failure tracking for cleanup
    failureCount: {
        type: Number,
        default: 0
    },
    lastFailure: Date,
    lastSuccess: Date,

    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for unique subscription per user+endpoint
pushSubscriptionSchema.index({ user: 1, 'subscription.endpoint': 1 }, { unique: true });

// Index for cleanup of inactive/failed subscriptions
pushSubscriptionSchema.index({ active: 1, failureCount: 1 });

// Update timestamp on save
pushSubscriptionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static: Get all active subscriptions for a user
pushSubscriptionSchema.statics.getActiveSubscriptions = async function(userId) {
    return this.find({
        user: userId,
        active: true,
        failureCount: { $lt: 3 } // Exclude subscriptions with too many failures
    });
};

// Static: Get subscriptions by preference type
pushSubscriptionSchema.statics.getSubscriptionsByPreference = async function(userId, preferenceType) {
    const query = {
        user: userId,
        active: true,
        failureCount: { $lt: 3 }
    };
    query[`preferences.${preferenceType}`] = true;
    return this.find(query);
};

// Static: Check if user has any active subscriptions
pushSubscriptionSchema.statics.hasActiveSubscription = async function(userId) {
    return this.exists({
        user: userId,
        active: true,
        failureCount: { $lt: 3 }
    });
};

// Instance: Mark subscription as failed
pushSubscriptionSchema.methods.markFailed = async function() {
    this.failureCount += 1;
    this.lastFailure = new Date();

    // Deactivate after 3 failures
    if (this.failureCount >= 3) {
        this.active = false;
    }

    return this.save();
};

// Instance: Mark subscription as successful
pushSubscriptionSchema.methods.markSuccess = async function() {
    this.failureCount = 0;
    this.lastSuccess = new Date();
    this.active = true;
    return this.save();
};

// Static: Cleanup old/inactive subscriptions
pushSubscriptionSchema.statics.cleanup = async function(daysOld = 90) {
    const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.deleteMany({
        $or: [
            { active: false, updatedAt: { $lt: threshold } },
            { failureCount: { $gte: 3 }, updatedAt: { $lt: threshold } }
        ]
    });

    return result.deletedCount;
};

// Static: Parse device info from user agent
pushSubscriptionSchema.statics.parseDeviceInfo = function(userAgent) {
    if (!userAgent) return { userAgent: 'unknown', deviceType: 'unknown', browser: 'unknown', os: 'unknown' };

    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) deviceType = 'mobile';
    else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';

    let browser = 'unknown';
    if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/edg/i.test(userAgent)) browser = 'Edge';

    let os = 'unknown';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

    return { userAgent, deviceType, browser, os };
};

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
