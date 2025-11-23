// server/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['success', 'info', 'warning', 'error'],
        default: 'info'
    },
    category: {
        type: String,
        enum: ['prediction', 'portfolio', 'watchlist', 'achievement', 'level', 'trade', 'system'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: 'Bell'
    },
    link: {
        type: String // URL to navigate when clicked
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed // Additional data
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for performance
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, data) {
    try {
        const notification = new this({
            user: userId,
            ...data
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
    const {
        limit = 20,
        skip = 0,
        unreadOnly = false
    } = options;

    const query = { user: userId };
    if (unreadOnly) {
        query.read = false;
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
    return this.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { read: true, readAt: new Date() },
        { new: true }
    );
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(userId) {
    return this.updateMany(
        { user: userId, read: false },
        { read: true, readAt: new Date() }
    );
};

// Static method to delete old notifications
notificationSchema.statics.deleteOldNotifications = async function(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return this.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true
    });
};

// Instance method to mark as read
notificationSchema.methods.markRead = async function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);