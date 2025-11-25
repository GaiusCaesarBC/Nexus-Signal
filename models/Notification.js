// server/models/Notification.js - Notification Model

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    // Target user
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Notification type
    type: {
        type: String,
        enum: [
            'follow',           // New follower
            'like',             // Like/reaction on post
            'comment',          // Comment on post
            'reply',            // Reply to comment
            'mention',          // Mentioned in post
            'share',            // Post shared/reposted
            'prediction_result', // Prediction outcome
            'price_alert',      // Price alert triggered
            'achievement',      // Achievement unlocked
            'level_up',         // Level up
            'portfolio_milestone', // Portfolio milestone
            'leaderboard',      // Leaderboard rank change
            'trade_copy',       // Someone copied your trade
            'login_streak',     // Login streak bonus
            'system',           // System notification
            'admin'             // Admin message
        ],
        required: true,
        index: true
    },

    // Display info
    title: {
        type: String,
        required: true,
        maxlength: 200
    },

    message: {
        type: String,
        required: true,
        maxlength: 500
    },

    icon: {
        type: String,
        default: 'bell'
    },

    // Link to navigate on click
    link: {
        type: String
    },

    // Additional data
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Read status
    read: {
        type: Boolean,
        default: false,
        index: true
    },

    // When it was read
    readAt: {
        type: Date
    }

}, {
    timestamps: true
});

// ============ INDEXES ============
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

// ============ METHODS ============
NotificationSchema.methods.markAsRead = async function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

// ============ STATICS ============
NotificationSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({ user: userId, read: false });
};

NotificationSchema.statics.markAllRead = async function(userId) {
    return this.updateMany(
        { user: userId, read: false },
        { read: true, readAt: new Date() }
    );
};

module.exports = mongoose.model('Notification', NotificationSchema);