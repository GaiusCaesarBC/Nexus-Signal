// TelegramGroup Model - Stores linked Telegram groups for notifications
const mongoose = require('mongoose');

const TelegramGroupSchema = new mongoose.Schema({
    // Telegram group/chat ID (string for large IDs)
    chatId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Group name/title
    name: {
        type: String,
        default: 'Unknown Group'
    },

    // Who linked the group
    linkedBy: {
        type: String,
        default: null
    },

    // Telegram user ID who linked
    linkedByUserId: {
        type: String,
        default: null
    },

    // When the group was linked
    linkedAt: {
        type: Date,
        default: Date.now
    },

    // Notification preferences for this group
    notifications: {
        economicEvents: { type: Boolean, default: true },
        whaleAlerts: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: true },
        mlPredictions: { type: Boolean, default: true }
    },

    // Is group currently active
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Static method to get all active groups
TelegramGroupSchema.statics.getActiveGroups = async function() {
    return await this.find({ isActive: true });
};

// Static method to link/update a group
TelegramGroupSchema.statics.linkGroup = async function(chatId, groupData) {
    return await this.findOneAndUpdate(
        { chatId: chatId.toString() },
        {
            chatId: chatId.toString(),
            name: groupData.name,
            linkedBy: groupData.linkedBy,
            linkedByUserId: groupData.linkedByUserId,
            linkedAt: new Date(),
            notifications: groupData.notifications || {
                economicEvents: true,
                whaleAlerts: true,
                dailySummary: true,
                mlPredictions: true
            },
            isActive: true
        },
        { upsert: true, new: true }
    );
};

// Static method to unlink a group
TelegramGroupSchema.statics.unlinkGroup = async function(chatId) {
    return await this.findOneAndUpdate(
        { chatId: chatId.toString() },
        { isActive: false },
        { new: true }
    );
};

// Static method to check if group is linked
TelegramGroupSchema.statics.isGroupLinked = async function(chatId) {
    const group = await this.findOne({ chatId: chatId.toString(), isActive: true });
    return !!group;
};

module.exports = mongoose.model('TelegramGroup', TelegramGroupSchema);
