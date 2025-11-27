// server/models/Notification.js - Notification Model

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'price_alert',
            'prediction_expiry',
            'prediction_result',
            'portfolio_milestone',
            'achievement',
            'level_up',
            'follow',
            'like',
            'comment',
            'system',
            'welcome',
            'info'
        ],
        default: 'info'
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    data: {
        // Flexible field for additional data based on notification type
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date,
        default: null
    },
    actionUrl: {
        type: String,
        default: null
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for common queries
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

// Instance method: Mark single notification as read
NotificationSchema.methods.markAsRead = async function() {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

// Static method: Mark all notifications as read for a user
NotificationSchema.statics.markAllAsRead = async function(userId) {
    const result = await this.updateMany(
        { user: userId, read: false },
        { $set: { read: true, readAt: new Date() } }
    );
    return result.modifiedCount;
};

// Static method: Get unread count for a user
NotificationSchema.statics.getUnreadCount = async function(userId) {
    return await this.countDocuments({ 
        user: userId, 
        read: false,
        $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: { $exists: false } },
            { expiresAt: null }
        ]
    });
};

// Static method: Create a notification
NotificationSchema.statics.createNotification = async function(userId, type, title, message, options = {}) {
    const notification = new this({
        user: userId,
        type,
        title,
        message,
        data: options.data || {},
        actionUrl: options.actionUrl || null,
        expiresAt: options.expiresAt || null
    });
    
    await notification.save();
    return notification;
};

// Static method: Create price alert notification
NotificationSchema.statics.createPriceAlert = async function(userId, symbol, price, targetPrice, direction) {
    return await this.createNotification(
        userId,
        'price_alert',
        `Price Alert: ${symbol}`,
        `${symbol} has ${direction === 'above' ? 'risen above' : 'fallen below'} $${targetPrice}. Current price: $${price}`,
        {
            data: { symbol, price, targetPrice, direction },
            actionUrl: '/watchlist'
        }
    );
};

// Static method: Create prediction result notification
NotificationSchema.statics.createPredictionResult = async function(userId, symbol, prediction, result, profit) {
    const isWin = result === 'win';
    return await this.createNotification(
        userId,
        'prediction_result',
        `Prediction ${isWin ? 'Correct!' : 'Incorrect'}`,
        `Your ${prediction} prediction for ${symbol} was ${isWin ? 'correct' : 'incorrect'}. ${isWin ? `+$${profit}` : ''}`,
        {
            data: { symbol, prediction, result, profit },
            actionUrl: '/predict'
        }
    );
};

// Static method: Create achievement notification
NotificationSchema.statics.createAchievementNotification = async function(userId, achievementName, achievementIcon) {
    return await this.createNotification(
        userId,
        'achievement',
        'Achievement Unlocked!',
        `You earned the "${achievementName}" achievement!`,
        {
            data: { achievementName, achievementIcon },
            actionUrl: '/achievements/browse'
        }
    );
};

// Static method: Create level up notification
NotificationSchema.statics.createLevelUpNotification = async function(userId, newLevel, rank) {
    return await this.createNotification(
        userId,
        'level_up',
        'Level Up!',
        `Congratulations! You've reached Level ${newLevel} - ${rank}!`,
        {
            data: { level: newLevel, rank },
            actionUrl: '/profile'
        }
    );
};

// Static method: Create follow notification
NotificationSchema.statics.createFollowNotification = async function(userId, followerName, followerId) {
    return await this.createNotification(
        userId,
        'follow',
        'New Follower',
        `${followerName} started following you!`,
        {
            data: { followerName, followerId },
            actionUrl: `/profile/${followerId}`
        }
    );
};

// Static method: Create welcome notification for new users
NotificationSchema.statics.createWelcomeNotification = async function(userId, userName) {
    return await this.createNotification(
        userId,
        'welcome',
        'Welcome to Nexus Signal!',
        `Hey ${userName}! Start by exploring the dashboard, making predictions, or checking out the leaderboard.`,
        {
            actionUrl: '/dashboard'
        }
    );
};

// Static method: Delete old read notifications (cleanup)
NotificationSchema.statics.cleanupOldNotifications = async function(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await this.deleteMany({
        read: true,
        createdAt: { $lt: cutoffDate }
    });
    
    return result.deletedCount;
};

module.exports = mongoose.model('Notification', NotificationSchema);