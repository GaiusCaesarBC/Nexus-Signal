// server/models/Notification.js - UNIFIED MODEL (Trading + Social)

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Notification category
  category: {
    type: String,
    enum: ['alert', 'social', 'system'],
    required: true,
    default: 'alert'
  },
  
  // Notification type
  type: {
    type: String,
    enum: [
      // Trading alerts
      'price_alert',
      'prediction_expiry',
      'portfolio_milestone',
      'price_change',
      
      // Social notifications
      'new_follower',
      'new_comment',
      'new_like',
      'post_mention',
      'comment_reply',
      
      // System notifications
      'achievement_unlocked',
      'level_up',
      'daily_bonus'
    ],
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
  
  // Related entity (post, comment, user, alert, etc.)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedType'
  },
  
  relatedType: {
    type: String,
    enum: ['Post', 'Comment', 'User', 'Alert', 'Prediction', 'Achievement']
  },
  
  // Actor (who triggered this notification)
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Additional data
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, read: 1 });

// Auto-delete read notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 30 * 24 * 60 * 60,
  partialFilterExpression: { read: true }
});

module.exports = mongoose.model('Notification', notificationSchema);