// server/services/notificationService.js - 🔥 LEGENDARY NOTIFICATION SERVICE 🔥

const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
    
    // ============ CREATE NOTIFICATION ============
    static async createNotification(userId, data) {
        try {
            const notification = await Notification.create({
                user: userId,
                type: data.type,
                title: data.title,
                message: data.message,
                icon: data.icon,
                link: data.link,
                data: data.data || {},
                read: false
            });

            console.log(`[Notification] Created ${data.type} notification for user ${userId}`);
            return notification;
        } catch (error) {
            console.error('[Notification] Create error:', error);
            return null;
        }
    }

    // ============ FOLLOW NOTIFICATION ============
    static async createFollowNotification(targetUserId, follower) {
        return this.createNotification(targetUserId, {
            type: 'follow',
            title: 'New Follower',
            message: `${follower.profile?.displayName || follower.username || follower.name} started following you`,
            icon: 'user-plus',
            link: `/profile/${follower.username}`,
            data: {
                followerId: follower._id,
                followerName: follower.profile?.displayName || follower.username || follower.name,
                followerAvatar: follower.profile?.avatar
            }
        });
    }

    // ============ LIKE NOTIFICATION ============
    static async createLikeNotification(targetUserId, liker, postId, reactionType = 'like') {
        const reactionEmojis = {
            like: '❤️',
            rocket: '🚀',
            fire: '🔥',
            diamond: '💎',
            bull: '🐂',
            bear: '🐻',
            money: '💰'
        };

        const emoji = reactionEmojis[reactionType] || '❤️';
        const likerName = liker.profile?.displayName || liker.username || liker.name;

        return this.createNotification(targetUserId, {
            type: 'like',
            title: 'New Reaction',
            message: `${likerName} ${emoji} reacted to your post`,
            icon: 'heart',
            link: `/post/${postId}`,
            data: {
                likerId: liker._id,
                likerName,
                likerAvatar: liker.profile?.avatar,
                postId,
                reactionType
            }
        });
    }

    // ============ COMMENT NOTIFICATION ============
    static async createCommentNotification(targetUserId, commenter, postId, commentPreview) {
        const commenterName = commenter.profile?.displayName || commenter.username || commenter.name;

        return this.createNotification(targetUserId, {
            type: 'comment',
            title: 'New Comment',
            message: `${commenterName} commented: "${commentPreview.substring(0, 50)}${commentPreview.length > 50 ? '...' : ''}"`,
            icon: 'message-circle',
            link: `/post/${postId}`,
            data: {
                commenterId: commenter._id,
                commenterName,
                commenterAvatar: commenter.profile?.avatar,
                postId,
                commentPreview
            }
        });
    }

    // ============ REPLY NOTIFICATION ============
    static async createReplyNotification(targetUserId, replier, postId, replyPreview) {
        const replierName = replier.profile?.displayName || replier.username || replier.name;

        return this.createNotification(targetUserId, {
            type: 'reply',
            title: 'New Reply',
            message: `${replierName} replied to your comment: "${replyPreview.substring(0, 50)}${replyPreview.length > 50 ? '...' : ''}"`,
            icon: 'corner-up-left',
            link: `/post/${postId}`,
            data: {
                replierId: replier._id,
                replierName,
                replierAvatar: replier.profile?.avatar,
                postId,
                replyPreview
            }
        });
    }

    // ============ MENTION NOTIFICATION ============
    static async createMentionNotification(targetUserId, mentioner, postId, postPreview) {
        const mentionerName = mentioner.profile?.displayName || mentioner.username || mentioner.name;

        return this.createNotification(targetUserId, {
            type: 'mention',
            title: 'You were mentioned',
            message: `${mentionerName} mentioned you in a post`,
            icon: 'at-sign',
            link: `/post/${postId}`,
            data: {
                mentionerId: mentioner._id,
                mentionerName,
                mentionerAvatar: mentioner.profile?.avatar,
                postId,
                postPreview
            }
        });
    }

    // ============ SHARE NOTIFICATION ============
    static async createShareNotification(targetUserId, sharer, postId) {
        const sharerName = sharer.profile?.displayName || sharer.username || sharer.name;

        return this.createNotification(targetUserId, {
            type: 'share',
            title: 'Post Shared',
            message: `${sharerName} shared your post`,
            icon: 'share-2',
            link: `/post/${postId}`,
            data: {
                sharerId: sharer._id,
                sharerName,
                sharerAvatar: sharer.profile?.avatar,
                postId
            }
        });
    }

    // ============ PREDICTION RESULT NOTIFICATION ============
    static async createPredictionResultNotification(targetUserId, prediction, isCorrect) {
        const emoji = isCorrect ? '✅' : '❌';
        const result = isCorrect ? 'correct' : 'incorrect';

        return this.createNotification(targetUserId, {
            type: 'prediction_result',
            title: `Prediction ${result.charAt(0).toUpperCase() + result.slice(1)}!`,
            message: `${emoji} Your ${prediction.symbol} prediction was ${result}!`,
            icon: isCorrect ? 'check-circle' : 'x-circle',
            link: `/predict`,
            data: {
                predictionId: prediction._id,
                symbol: prediction.symbol,
                direction: prediction.direction,
                isCorrect,
                actualPrice: prediction.result?.actualPrice
            }
        });
    }

    // ============ PRICE ALERT NOTIFICATION ============
    static async createPriceAlertNotification(targetUserId, alert) {
        const direction = alert.condition === 'above' ? '📈' : '📉';

        return this.createNotification(targetUserId, {
            type: 'price_alert',
            title: `${alert.symbol} Price Alert`,
            message: `${direction} ${alert.symbol} is now ${alert.condition} $${alert.targetPrice}`,
            icon: 'trending-up',
            link: `/stock/${alert.symbol}`,
            data: {
                alertId: alert._id,
                symbol: alert.symbol,
                targetPrice: alert.targetPrice,
                currentPrice: alert.triggeredPrice,
                condition: alert.condition
            }
        });
    }

    // ============ ACHIEVEMENT NOTIFICATION ============
    static async createAchievementNotification(targetUserId, achievement) {
        return this.createNotification(targetUserId, {
            type: 'achievement',
            title: '🏆 Achievement Unlocked!',
            message: `You earned "${achievement.name}"! +${achievement.xpReward || 0} XP`,
            icon: 'award',
            link: `/achievements`,
            data: {
                achievementId: achievement.id,
                achievementName: achievement.name,
                achievementIcon: achievement.icon,
                xpReward: achievement.xpReward
            }
        });
    }

    // ============ LEVEL UP NOTIFICATION ============
    static async createLevelUpNotification(targetUserId, newLevel, newTitle) {
        return this.createNotification(targetUserId, {
            type: 'level_up',
            title: '🎉 Level Up!',
            message: `Congratulations! You reached Level ${newLevel} - ${newTitle}`,
            icon: 'star',
            link: `/profile`,
            data: {
                level: newLevel,
                title: newTitle
            }
        });
    }

    // ============ PORTFOLIO MILESTONE NOTIFICATION ============
    static async createPortfolioMilestoneNotification(targetUserId, milestone) {
        return this.createNotification(targetUserId, {
            type: 'portfolio_milestone',
            title: '📊 Portfolio Milestone!',
            message: milestone.message,
            icon: 'trending-up',
            link: `/portfolio`,
            data: milestone
        });
    }

    // ============ LEADERBOARD NOTIFICATION ============
    static async createLeaderboardNotification(targetUserId, rank, previousRank) {
        const change = previousRank - rank;
        const emoji = change > 0 ? '🚀' : '📉';

        return this.createNotification(targetUserId, {
            type: 'leaderboard',
            title: `${emoji} Leaderboard Update`,
            message: change > 0 
                ? `You climbed ${change} spots to #${rank}!` 
                : `You're now #${rank} on the leaderboard`,
            icon: 'trophy',
            link: `/leaderboard`,
            data: {
                rank,
                previousRank,
                change
            }
        });
    }

    // ============ TRADE COPY NOTIFICATION ============
    static async createTradeCopyNotification(targetUserId, copier, trade) {
        const copierName = copier.profile?.displayName || copier.username || copier.name;

        return this.createNotification(targetUserId, {
            type: 'trade_copy',
            title: 'Trade Copied!',
            message: `${copierName} copied your ${trade.symbol} trade`,
            icon: 'copy',
            link: `/paper-trading`,
            data: {
                copierId: copier._id,
                copierName,
                symbol: trade.symbol,
                direction: trade.direction
            }
        });
    }

    // ============ WELCOME NOTIFICATION ============
    static async createWelcomeNotification(userId) {
        return this.createNotification(userId, {
            type: 'system',
            title: '🎉 Welcome to Nexus Signal!',
            message: 'Start by exploring the dashboard, making predictions, or following top traders.',
            icon: 'zap',
            link: `/dashboard`,
            data: {
                isWelcome: true
            }
        });
    }

    // ============ DAILY LOGIN STREAK NOTIFICATION ============
    static async createLoginStreakNotification(userId, streak, bonusXp) {
        return this.createNotification(userId, {
            type: 'login_streak',
            title: `🔥 ${streak} Day Streak!`,
            message: `Keep it up! You earned ${bonusXp} bonus XP`,
            icon: 'flame',
            link: `/dashboard`,
            data: {
                streak,
                bonusXp
            }
        });
    }

    // ============ SYSTEM NOTIFICATION (GENERIC) ============
    static async notifySystem(userId, title, message) {
        return this.createNotification(userId, {
            type: 'system',
            title,
            message,
            icon: 'info',
            link: '/dashboard'
        });
    }

    // ============ LEVEL UP NOTIFICATION (ALIAS) ============
    static async notifyLevelUp(userId, data) {
        return this.createLevelUpNotification(userId, data.level, data.title || data.rank);
    }

    // ============ ACHIEVEMENT UNLOCKED NOTIFICATION (ALIAS) ============
    static async notifyAchievementUnlocked(userId, data) {
        return this.createAchievementNotification(userId, {
            id: data.achievementId || data.id,
            name: data.name || data.achievementName,
            icon: data.icon || data.achievementIcon,
            xpReward: data.xpReward || 0
        });
    }

    // ============ TRADE PROFITABLE NOTIFICATION ============
    static async notifyTradeProfitable(userId, data) {
        return this.createNotification(userId, {
            type: 'portfolio_milestone',
            title: '📈 Profitable Trade!',
            message: `Your ${data.symbol} trade is up ${data.profitPercent?.toFixed(2) || 0}%!`,
            icon: 'trending-up',
            link: '/paper-trading',
            data
        });
    }

    // ============ TRADE LOSS NOTIFICATION ============
    static async notifyTradeLoss(userId, data) {
        return this.createNotification(userId, {
            type: 'portfolio_milestone',
            title: '📉 Trade Update',
            message: `Your ${data.symbol} trade is down ${Math.abs(data.lossPercent || 0).toFixed(2)}%`,
            icon: 'trending-down',
            link: '/paper-trading',
            data
        });
    }

    // ============ PORTFOLIO GAIN NOTIFICATION ============
    static async notifyPortfolioGain(userId, data) {
        return this.createNotification(userId, {
            type: 'portfolio_milestone',
            title: '🎉 Portfolio Milestone!',
            message: data.message || `Your portfolio is up ${data.gainPercent?.toFixed(2) || 0}%!`,
            icon: 'trending-up',
            link: '/portfolio',
            data
        });
    }

    // ============ PORTFOLIO LOSS NOTIFICATION ============
    static async notifyPortfolioLoss(userId, data) {
        return this.createNotification(userId, {
            type: 'portfolio_milestone',
            title: '📊 Portfolio Update',
            message: data.message || `Your portfolio is down ${Math.abs(data.lossPercent || 0).toFixed(2)}%`,
            icon: 'alert-triangle',
            link: '/portfolio',
            data
        });
    }

    // ============ CREATE (ALIAS FOR BADGE SERVICE) ============
    static async create(data) {
        if (!data.user) return null;
        return this.createNotification(data.user, {
            type: data.type || 'system',
            title: data.title,
            message: data.message,
            icon: data.icon,
            link: data.link || data.actionUrl,
            data: data.data || {}
        });
    }

    // ============ MARK AS READ ============
    static async markAsRead(notificationId) {
        try {
            await Notification.findByIdAndUpdate(notificationId, { read: true });
            return true;
        } catch (error) {
            console.error('[Notification] Mark read error:', error);
            return false;
        }
    }

    // ============ MARK ALL AS READ ============
    static async markAllAsRead(userId) {
        try {
            await Notification.updateMany(
                { user: userId, read: false },
                { read: true }
            );
            return true;
        } catch (error) {
            console.error('[Notification] Mark all read error:', error);
            return false;
        }
    }

    // ============ GET USER NOTIFICATIONS ============
    static async getUserNotifications(userId, limit = 50, skip = 0) {
        try {
            const notifications = await Notification.find({ user: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const unreadCount = await Notification.countDocuments({
                user: userId,
                read: false
            });

            return { notifications, unreadCount };
        } catch (error) {
            console.error('[Notification] Get notifications error:', error);
            return { notifications: [], unreadCount: 0 };
        }
    }

    // ============ DELETE OLD NOTIFICATIONS ============
    static async cleanupOldNotifications(daysOld = 30) {
        try {
            const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
            
            const result = await Notification.deleteMany({
                createdAt: { $lt: threshold },
                read: true
            });

            console.log(`[Notification] Cleaned up ${result.deletedCount} old notifications`);
            return result.deletedCount;
        } catch (error) {
            console.error('[Notification] Cleanup error:', error);
            return 0;
        }
    }
}

module.exports = NotificationService;