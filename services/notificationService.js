// server/services/notificationService.js - Helper for creating notifications

const Notification = require('../models/Notification');

class NotificationService {
  
  // ============ SOCIAL NOTIFICATIONS ============
  
  static async createFollowNotification(followedUserId, followerUser) {
    try {
      await Notification.create({
        userId: followedUserId,
        category: 'social',
        type: 'new_follower',
        title: 'New Follower',
        message: `${followerUser.name} started following you`,
        actorId: followerUser._id,
        relatedId: followerUser._id,
        relatedType: 'User'
      });
      console.log(`[Notification] Created follow notification for user ${followedUserId}`);
    } catch (error) {
      console.error('[Notification] Error creating follow notification:', error);
    }
  }

  static async createCommentNotification(postAuthorId, commenterUser, postId, commentText) {
    try {
      // Don't notify if commenting on own post
      if (postAuthorId.toString() === commenterUser._id.toString()) return;

      await Notification.create({
        userId: postAuthorId,
        category: 'social',
        type: 'new_comment',
        title: 'New Comment',
        message: `${commenterUser.name} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
        actorId: commenterUser._id,
        relatedId: postId,
        relatedType: 'Post',
        metadata: {
          commentPreview: commentText.substring(0, 100)
        }
      });
      console.log(`[Notification] Created comment notification for user ${postAuthorId}`);
    } catch (error) {
      console.error('[Notification] Error creating comment notification:', error);
    }
  }

  static async createLikeNotification(postAuthorId, likerUser, postId) {
    try {
      // Don't notify if liking own post
      if (postAuthorId.toString() === likerUser._id.toString()) return;

      // Check if notification already exists (avoid spam)
      const existingNotif = await Notification.findOne({
        userId: postAuthorId,
        actorId: likerUser._id,
        relatedId: postId,
        type: 'new_like',
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      });

      if (existingNotif) return;

      await Notification.create({
        userId: postAuthorId,
        category: 'social',
        type: 'new_like',
        title: 'New Like',
        message: `${likerUser.name} liked your post`,
        actorId: likerUser._id,
        relatedId: postId,
        relatedType: 'Post'
      });
      console.log(`[Notification] Created like notification for user ${postAuthorId}`);
    } catch (error) {
      console.error('[Notification] Error creating like notification:', error);
    }
  }

  static async createMentionNotification(mentionedUserId, mentionerUser, postId, text) {
    try {
      await Notification.create({
        userId: mentionedUserId,
        category: 'social',
        type: 'post_mention',
        title: 'You Were Mentioned',
        message: `${mentionerUser.name} mentioned you in a post`,
        actorId: mentionerUser._id,
        relatedId: postId,
        relatedType: 'Post',
        metadata: {
          textPreview: text.substring(0, 100)
        }
      });
      console.log(`[Notification] Created mention notification for user ${mentionedUserId}`);
    } catch (error) {
      console.error('[Notification] Error creating mention notification:', error);
    }
  }

  static async createReplyNotification(originalCommentAuthorId, replierUser, postId, replyText) {
    try {
      // Don't notify if replying to own comment
      if (originalCommentAuthorId.toString() === replierUser._id.toString()) return;

      await Notification.create({
        userId: originalCommentAuthorId,
        category: 'social',
        type: 'comment_reply',
        title: 'New Reply',
        message: `${replierUser.name} replied to your comment: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
        actorId: replierUser._id,
        relatedId: postId,
        relatedType: 'Post',
        metadata: {
          replyPreview: replyText.substring(0, 100)
        }
      });
      console.log(`[Notification] Created reply notification for user ${originalCommentAuthorId}`);
    } catch (error) {
      console.error('[Notification] Error creating reply notification:', error);
    }
  }

  // ============ TRADING ALERT NOTIFICATIONS ============
  
  static async createAlertNotification(userId, alertType, title, message, alertId) {
    try {
      await Notification.create({
        userId,
        category: 'alert',
        type: 'price_alert',
        title,
        message,
        relatedId: alertId,
        relatedType: 'Alert'
      });
      console.log(`[Notification] Created alert notification for user ${userId}`);
    } catch (error) {
      console.error('[Notification] Error creating alert notification:', error);
    }
  }

  static async createPredictionExpiryNotification(userId, symbol, expiryTime, predictionId) {
    try {
      await Notification.create({
        userId,
        category: 'alert',
        type: 'prediction_expiry',
        title: 'Prediction Expiring Soon',
        message: `Your ${symbol} prediction expires in ${expiryTime}`,
        relatedId: predictionId,
        relatedType: 'Prediction'
      });
      console.log(`[Notification] Created prediction expiry notification for user ${userId}`);
    } catch (error) {
      console.error('[Notification] Error creating prediction expiry notification:', error);
    }
  }

  // ============ SYSTEM NOTIFICATIONS ============
  
  static async createAchievementNotification(userId, achievementName, achievementId) {
    try {
      await Notification.create({
        userId,
        category: 'system',
        type: 'achievement_unlocked',
        title: '🏆 Achievement Unlocked!',
        message: `You unlocked: ${achievementName}`,
        relatedId: achievementId,
        relatedType: 'Achievement'
      });
      console.log(`[Notification] Created achievement notification for user ${userId}`);
    } catch (error) {
      console.error('[Notification] Error creating achievement notification:', error);
    }
  }

  static async createLevelUpNotification(userId, newLevel) {
    try {
      await Notification.create({
        userId,
        category: 'system',
        type: 'level_up',
        title: '⬆️ Level Up!',
        message: `Congratulations! You reached level ${newLevel}`,
        metadata: { level: newLevel }
      });
      console.log(`[Notification] Created level up notification for user ${userId}`);
    } catch (error) {
      console.error('[Notification] Error creating level up notification:', error);
    }
  }

  // ============ BULK OPERATIONS ============
  
  static async getUnreadCount(userId, category = null) {
    try {
      const query = { userId, read: false };
      if (category) query.category = category;
      
      return await Notification.countDocuments(query);
    } catch (error) {
      console.error('[Notification] Error getting unread count:', error);
      return 0;
    }
  }

  static async markAllAsRead(userId, category = null) {
    try {
      const query = { userId, read: false };
      if (category) query.category = category;
      
      await Notification.updateMany(query, { read: true });
      console.log(`[Notification] Marked all notifications as read for user ${userId}`);
    } catch (error) {
      console.error('[Notification] Error marking all as read:', error);
    }
  }
}

module.exports = NotificationService;