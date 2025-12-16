// DiscordServer Model - Stores linked Discord servers/channels for notifications
const mongoose = require('mongoose');

const DiscordServerSchema = new mongoose.Schema({
    // Discord guild (server) ID
    guildId: {
        type: String,
        required: true,
        index: true
    },

    // Discord channel ID where notifications are sent
    channelId: {
        type: String,
        required: true
    },

    // Server name
    guildName: {
        type: String,
        default: 'Unknown Server'
    },

    // Channel name
    channelName: {
        type: String,
        default: 'Unknown Channel'
    },

    // Who linked the server (Discord username)
    linkedBy: {
        type: String,
        default: null
    },

    // Discord user ID who linked
    linkedByUserId: {
        type: String,
        default: null
    },

    // When the server was linked
    linkedAt: {
        type: Date,
        default: Date.now
    },

    // Notification preferences for this server
    notifications: {
        economicEvents: { type: Boolean, default: true },
        whaleAlerts: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: true },
        mlPredictions: { type: Boolean, default: true },
        priceAlerts: { type: Boolean, default: true }
    },

    // Is server currently active
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound unique index on guildId + channelId
DiscordServerSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

// Static method to get all active servers
DiscordServerSchema.statics.getActiveServers = async function() {
    return await this.find({ isActive: true });
};

// Static method to link/update a server channel
DiscordServerSchema.statics.linkServer = async function(guildId, channelId, serverData) {
    return await this.findOneAndUpdate(
        { guildId: guildId.toString(), channelId: channelId.toString() },
        {
            guildId: guildId.toString(),
            channelId: channelId.toString(),
            guildName: serverData.guildName,
            channelName: serverData.channelName,
            linkedBy: serverData.linkedBy,
            linkedByUserId: serverData.linkedByUserId,
            linkedAt: new Date(),
            notifications: serverData.notifications || {
                economicEvents: true,
                whaleAlerts: true,
                dailySummary: true,
                mlPredictions: true,
                priceAlerts: true
            },
            isActive: true
        },
        { upsert: true, new: true }
    );
};

// Static method to unlink a server channel
DiscordServerSchema.statics.unlinkServer = async function(guildId, channelId) {
    return await this.findOneAndUpdate(
        { guildId: guildId.toString(), channelId: channelId.toString() },
        { isActive: false },
        { new: true }
    );
};

// Static method to check if server channel is linked
DiscordServerSchema.statics.isServerLinked = async function(guildId, channelId) {
    const server = await this.findOne({
        guildId: guildId.toString(),
        channelId: channelId.toString(),
        isActive: true
    });
    return !!server;
};

// Static method to update notification preferences
DiscordServerSchema.statics.updateNotifications = async function(guildId, channelId, notifications) {
    return await this.findOneAndUpdate(
        { guildId: guildId.toString(), channelId: channelId.toString() },
        { $set: { notifications } },
        { new: true }
    );
};

module.exports = mongoose.model('DiscordServer', DiscordServerSchema);
