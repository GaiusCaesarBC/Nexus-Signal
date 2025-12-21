// server/services/pushNotificationService.js - Web Push Notification Service
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Configure web-push with VAPID keys
// These should be generated once and stored in environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@nexussignal.com';

// Initialize web-push if keys are configured
let pushConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        pushConfigured = true;
        console.log('[PushNotification] Web push configured successfully');
    } catch (error) {
        console.error('[PushNotification] Failed to configure web push:', error.message);
    }
} else {
    console.warn('[PushNotification] VAPID keys not configured - push notifications disabled');
}

// Notification icons based on type
const NOTIFICATION_ICONS = {
    prediction_result: '/icons/prediction.png',
    price_alert: '/icons/alert.png',
    copy_executed: '/icons/copy.png',
    copy_completed: '/icons/copy.png',
    follow: '/icons/social.png',
    like: '/icons/heart.png',
    comment: '/icons/comment.png',
    mention: '/icons/mention.png',
    achievement: '/icons/trophy.png',
    level_up: '/icons/star.png',
    system: '/icons/nexus.png',
    default: '/icons/nexus.png'
};

// Notification preference mapping
const TYPE_TO_PREFERENCE = {
    prediction_result: 'predictions',
    price_alert: 'priceAlerts',
    copy_executed: 'copyTrading',
    copy_completed: 'copyTrading',
    follow: 'social',
    like: 'social',
    comment: 'social',
    mention: 'social',
    reply: 'social',
    share: 'social',
    achievement: 'achievements',
    level_up: 'achievements',
    login_streak: 'achievements',
    portfolio_milestone: 'predictions',
    leaderboard: 'achievements',
    trade_copy: 'copyTrading',
    system: 'system',
    marketing: 'marketing'
};

class PushNotificationService {
    /**
     * Check if push notifications are available
     */
    static isAvailable() {
        return pushConfigured;
    }

    /**
     * Get VAPID public key for client subscription
     */
    static getPublicKey() {
        return VAPID_PUBLIC_KEY;
    }

    /**
     * Generate new VAPID keys (run once, then store in env)
     */
    static generateVapidKeys() {
        return webpush.generateVAPIDKeys();
    }

    /**
     * Subscribe a user to push notifications
     */
    static async subscribe(userId, subscription, userAgent) {
        try {
            if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
                throw new Error('Invalid subscription object');
            }

            const deviceInfo = PushSubscription.parseDeviceInfo(userAgent);

            // Upsert subscription (update if exists, create if not)
            const pushSub = await PushSubscription.findOneAndUpdate(
                { user: userId, 'subscription.endpoint': subscription.endpoint },
                {
                    user: userId,
                    subscription: {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.keys.p256dh,
                            auth: subscription.keys.auth
                        }
                    },
                    deviceInfo,
                    active: true,
                    failureCount: 0,
                    updatedAt: new Date()
                },
                { upsert: true, new: true }
            );

            console.log(`[PushNotification] User ${userId} subscribed from ${deviceInfo.browser} on ${deviceInfo.os}`);
            return pushSub;
        } catch (error) {
            console.error('[PushNotification] Subscribe error:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe a user's device from push notifications
     */
    static async unsubscribe(userId, endpoint) {
        try {
            const result = await PushSubscription.findOneAndDelete({
                user: userId,
                'subscription.endpoint': endpoint
            });

            if (result) {
                console.log(`[PushNotification] User ${userId} unsubscribed device`);
            }
            return !!result;
        } catch (error) {
            console.error('[PushNotification] Unsubscribe error:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe all devices for a user
     */
    static async unsubscribeAll(userId) {
        try {
            const result = await PushSubscription.deleteMany({ user: userId });
            console.log(`[PushNotification] Removed ${result.deletedCount} subscriptions for user ${userId}`);
            return result.deletedCount;
        } catch (error) {
            console.error('[PushNotification] Unsubscribe all error:', error);
            throw error;
        }
    }

    /**
     * Update notification preferences for a user
     */
    static async updatePreferences(userId, preferences) {
        try {
            await PushSubscription.updateMany(
                { user: userId },
                { $set: { preferences } }
            );
            return true;
        } catch (error) {
            console.error('[PushNotification] Update preferences error:', error);
            throw error;
        }
    }

    /**
     * Get user's subscriptions and preferences
     */
    static async getSubscriptions(userId) {
        try {
            const subscriptions = await PushSubscription.find({ user: userId })
                .select('-subscription.keys') // Don't expose keys
                .lean();

            return subscriptions.map(sub => ({
                id: sub._id,
                deviceInfo: sub.deviceInfo,
                preferences: sub.preferences,
                active: sub.active,
                createdAt: sub.createdAt
            }));
        } catch (error) {
            console.error('[PushNotification] Get subscriptions error:', error);
            return [];
        }
    }

    /**
     * Send push notification to a single subscription
     */
    static async sendToSubscription(subscription, payload) {
        if (!pushConfigured) {
            console.warn('[PushNotification] Push not configured, skipping');
            return false;
        }

        try {
            const pushPayload = JSON.stringify({
                title: payload.title,
                body: payload.message || payload.body,
                icon: NOTIFICATION_ICONS[payload.type] || NOTIFICATION_ICONS.default,
                badge: '/icons/badge.png',
                tag: payload.tag || payload.type,
                data: {
                    url: payload.link || payload.url || '/',
                    type: payload.type,
                    timestamp: Date.now(),
                    ...payload.data
                },
                actions: payload.actions || [],
                requireInteraction: payload.requireInteraction || false,
                silent: payload.silent || false
            });

            await webpush.sendNotification(
                {
                    endpoint: subscription.subscription.endpoint,
                    keys: subscription.subscription.keys
                },
                pushPayload,
                {
                    TTL: payload.ttl || 86400, // 24 hours default
                    urgency: payload.urgency || 'normal' // low, normal, high
                }
            );

            // Mark successful
            if (subscription.markSuccess) {
                await subscription.markSuccess();
            }

            return true;
        } catch (error) {
            console.error('[PushNotification] Send error:', error.statusCode, error.message);

            // Handle subscription errors
            if (error.statusCode === 404 || error.statusCode === 410) {
                // Subscription expired or invalid, remove it
                console.log('[PushNotification] Subscription expired, removing');
                await PushSubscription.deleteOne({ _id: subscription._id });
            } else if (subscription.markFailed) {
                // Other error, increment failure count
                await subscription.markFailed();
            }

            return false;
        }
    }

    /**
     * Send push notification to a user (all their devices)
     */
    static async sendToUser(userId, payload) {
        if (!pushConfigured) return { sent: 0, failed: 0 };

        try {
            // Get preference type for filtering
            const preferenceType = TYPE_TO_PREFERENCE[payload.type] || 'system';

            // Get active subscriptions with this preference enabled
            const subscriptions = await PushSubscription.getSubscriptionsByPreference(userId, preferenceType);

            if (subscriptions.length === 0) {
                return { sent: 0, failed: 0 };
            }

            let sent = 0;
            let failed = 0;

            // Send to all devices in parallel
            const results = await Promise.allSettled(
                subscriptions.map(sub => this.sendToSubscription(sub, payload))
            );

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    sent++;
                } else {
                    failed++;
                }
            });

            console.log(`[PushNotification] Sent to user ${userId}: ${sent} success, ${failed} failed`);
            return { sent, failed };
        } catch (error) {
            console.error('[PushNotification] Send to user error:', error);
            return { sent: 0, failed: 0 };
        }
    }

    /**
     * Send push notification to multiple users
     */
    static async sendToUsers(userIds, payload) {
        if (!pushConfigured) return { sent: 0, failed: 0 };

        const results = await Promise.allSettled(
            userIds.map(userId => this.sendToUser(userId, payload))
        );

        let totalSent = 0;
        let totalFailed = 0;

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                totalSent += result.value.sent;
                totalFailed += result.value.failed;
            }
        });

        return { sent: totalSent, failed: totalFailed };
    }

    /**
     * Send push notification to all users with a preference
     */
    static async broadcast(payload, preferenceType = 'system') {
        if (!pushConfigured) return { sent: 0, failed: 0 };

        try {
            // Get all unique user IDs with this preference enabled
            const subscriptions = await PushSubscription.find({
                active: true,
                failureCount: { $lt: 3 },
                [`preferences.${preferenceType}`]: true
            }).distinct('user');

            if (subscriptions.length === 0) {
                return { sent: 0, failed: 0 };
            }

            return this.sendToUsers(subscriptions, payload);
        } catch (error) {
            console.error('[PushNotification] Broadcast error:', error);
            return { sent: 0, failed: 0 };
        }
    }

    // ============ CONVENIENCE METHODS ============

    /**
     * Send prediction result notification
     */
    static async notifyPredictionResult(userId, prediction, isCorrect) {
        const emoji = isCorrect ? '✅' : '❌';
        return this.sendToUser(userId, {
            type: 'prediction_result',
            title: `${emoji} Prediction ${isCorrect ? 'Correct' : 'Incorrect'}!`,
            message: `Your ${prediction.symbol} ${prediction.direction} prediction was ${isCorrect ? 'correct' : 'incorrect'}!`,
            link: '/predict',
            data: { predictionId: prediction._id, symbol: prediction.symbol },
            tag: `prediction-${prediction._id}`
        });
    }

    /**
     * Send price alert notification
     */
    static async notifyPriceAlert(userId, alert) {
        const emoji = alert.condition === 'above' ? '📈' : '📉';
        return this.sendToUser(userId, {
            type: 'price_alert',
            title: `${emoji} ${alert.symbol} Price Alert!`,
            message: `${alert.symbol} is now ${alert.condition} $${alert.targetPrice}`,
            link: `/stock/${alert.symbol}`,
            data: { alertId: alert._id, symbol: alert.symbol },
            tag: `alert-${alert._id}`,
            urgency: 'high'
        });
    }

    /**
     * Send copy trade executed notification
     */
    static async notifyCopyExecuted(userId, copyData) {
        return this.sendToUser(userId, {
            type: 'copy_executed',
            title: '📋 Trade Copied!',
            message: `Copied ${copyData.direction} prediction for ${copyData.symbol}`,
            link: '/copy-trading',
            data: { symbol: copyData.symbol, predictionId: copyData.predictionId },
            tag: `copy-${copyData.predictionId}`
        });
    }

    /**
     * Send copy trade completed notification
     */
    static async notifyCopyCompleted(userId, copyData) {
        const emoji = copyData.wasCorrect ? '🎉' : '📊';
        const pnl = copyData.profitLossPercent >= 0
            ? `+${copyData.profitLossPercent.toFixed(2)}%`
            : `${copyData.profitLossPercent.toFixed(2)}%`;
        return this.sendToUser(userId, {
            type: 'copy_completed',
            title: `${emoji} Copy Trade ${copyData.wasCorrect ? 'Won' : 'Closed'}!`,
            message: `${copyData.symbol}: ${pnl}`,
            link: '/copy-trading',
            data: copyData
        });
    }

    /**
     * Send social notification (follow, like, comment)
     */
    static async notifySocial(userId, type, actor, data = {}) {
        const actorName = actor.profile?.displayName || actor.username;
        const messages = {
            follow: `${actorName} started following you`,
            like: `${actorName} liked your post`,
            comment: `${actorName} commented on your post`,
            mention: `${actorName} mentioned you`,
            reply: `${actorName} replied to your comment`
        };

        return this.sendToUser(userId, {
            type,
            title: type === 'follow' ? 'New Follower!' : 'New Activity',
            message: messages[type] || `${actorName} interacted with you`,
            link: data.link || `/profile/${actor.username}`,
            data: { actorId: actor._id, ...data }
        });
    }

    /**
     * Send achievement notification
     */
    static async notifyAchievement(userId, achievement) {
        return this.sendToUser(userId, {
            type: 'achievement',
            title: '🏆 Achievement Unlocked!',
            message: `You earned "${achievement.name}"!`,
            link: '/achievements',
            data: { achievementId: achievement.id },
            tag: `achievement-${achievement.id}`
        });
    }

    /**
     * Send level up notification
     */
    static async notifyLevelUp(userId, level, title) {
        return this.sendToUser(userId, {
            type: 'level_up',
            title: '⭐ Level Up!',
            message: `You reached Level ${level} - ${title}!`,
            link: '/profile',
            data: { level, title },
            tag: `level-${level}`
        });
    }
}

module.exports = PushNotificationService;
