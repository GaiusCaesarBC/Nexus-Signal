// server/routes/notificationRoutes.js - Notification Management API

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

// Rate limiter for notification endpoints (60 requests per minute)
const notificationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests, please slow down' }
});

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', notificationLimiter, auth, async (req, res) => {
    try {
        const { limit = 50, unreadOnly = false } = req.query;

        const query = { user: req.user.id };
        
        if (unreadOnly === 'true') {
            query.read = false;
        }

        // Don't show expired notifications
        query.$or = [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: { $exists: false } }
        ];

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: notifications.length,
            notifications
        });

    } catch (error) {
        console.error('[Notifications] Fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notifications',
            message: error.message 
        });
    }
});

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
router.get('/unread-count', notificationLimiter, auth, async (req, res) => {
    try {
        const count = await Notification.getUnreadCount(req.user.id);

        res.json({
            success: true,
            count
        });

    } catch (error) {
        console.error('[Notifications] Unread count error:', error);
        res.status(500).json({ 
            error: 'Failed to get unread count',
            message: error.message 
        });
    }
});

// @route   GET /api/notifications/:id
// @desc    Get single notification
// @access  Private
router.get('/:id', notificationLimiter, auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Auto-mark as read when viewed
        if (!notification.read) {
            await notification.markAsRead();
        }

        res.json({
            success: true,
            notification
        });

    } catch (error) {
        console.error('[Notifications] Fetch single error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notification',
            message: error.message 
        });
    }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', notificationLimiter, auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await notification.markAsRead();

        res.json({
            success: true,
            notification
        });

    } catch (error) {
        console.error('[Notifications] Mark read error:', error);
        res.status(500).json({ 
            error: 'Failed to mark notification as read',
            message: error.message 
        });
    }
});

// @route   POST /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.post('/mark-all-read', notificationLimiter, auth, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { user: req.user.id, read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        res.json({
            success: true,
            marked: result.modifiedCount
        });

    } catch (error) {
        console.error('[Notifications] Mark all read error:', error);
        res.status(500).json({ 
            error: 'Failed to mark all notifications as read',
            message: error.message 
        });
    }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', notificationLimiter, auth, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });

    } catch (error) {
        console.error('[Notifications] Delete error:', error);
        res.status(500).json({ 
            error: 'Failed to delete notification',
            message: error.message 
        });
    }
});

// @route   POST /api/notifications/clear-all
// @desc    Clear all read notifications
// @access  Private
router.post('/clear-all', notificationLimiter, auth, async (req, res) => {
    try {
        const result = await Notification.deleteMany({
            user: req.user.id,
            read: true
        });

        res.json({
            success: true,
            deleted: result.deletedCount
        });

    } catch (error) {
        console.error('[Notifications] Clear all error:', error);
        res.status(500).json({ 
            error: 'Failed to clear notifications',
            message: error.message 
        });
    }
});

// @route   GET /api/notifications/by-type/:type
// @desc    Get notifications by type
// @access  Private
router.get('/by-type/:type', notificationLimiter, auth, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const { type } = req.params;

        const notifications = await Notification.find({
            user: req.user.id,
            type: type
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

        res.json({
            success: true,
            count: notifications.length,
            notifications
        });

    } catch (error) {
        console.error('[Notifications] Fetch by type error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notifications',
            message: error.message 
        });
    }
});

module.exports = router;