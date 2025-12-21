// server/routes/pushRoutes.js - Web Push Notification API Routes
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const PushNotificationService = require('../services/pushNotificationService');
const PushSubscription = require('../models/PushSubscription');

// Rate limiter for push endpoints
const pushLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please slow down' }
});

// @route   GET /api/push/vapid-key
// @desc    Get VAPID public key for subscription
// @access  Public
router.get('/vapid-key', (req, res) => {
    const publicKey = PushNotificationService.getPublicKey();

    if (!publicKey) {
        return res.status(503).json({
            success: false,
            error: 'Push notifications not configured',
            available: false
        });
    }

    res.json({
        success: true,
        available: true,
        publicKey
    });
});

// @route   GET /api/push/status
// @desc    Check if push notifications are available
// @access  Public
router.get('/status', (req, res) => {
    res.json({
        success: true,
        available: PushNotificationService.isAvailable()
    });
});

// @route   POST /api/push/subscribe
// @desc    Subscribe device to push notifications
// @access  Private
router.post('/subscribe', pushLimiter, auth, async (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription object'
            });
        }

        const userAgent = req.headers['user-agent'];
        const result = await PushNotificationService.subscribe(
            req.user.id,
            subscription,
            userAgent
        );

        res.json({
            success: true,
            message: 'Successfully subscribed to push notifications',
            subscription: {
                id: result._id,
                deviceInfo: result.deviceInfo,
                preferences: result.preferences
            }
        });
    } catch (error) {
        console.error('[Push Routes] Subscribe error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to subscribe',
            message: error.message
        });
    }
});

// @route   POST /api/push/unsubscribe
// @desc    Unsubscribe device from push notifications
// @access  Private
router.post('/unsubscribe', pushLimiter, auth, async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                error: 'Endpoint required'
            });
        }

        const result = await PushNotificationService.unsubscribe(req.user.id, endpoint);

        res.json({
            success: true,
            message: result ? 'Successfully unsubscribed' : 'Subscription not found'
        });
    } catch (error) {
        console.error('[Push Routes] Unsubscribe error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unsubscribe',
            message: error.message
        });
    }
});

// @route   DELETE /api/push/unsubscribe-all
// @desc    Unsubscribe all devices for user
// @access  Private
router.delete('/unsubscribe-all', pushLimiter, auth, async (req, res) => {
    try {
        const count = await PushNotificationService.unsubscribeAll(req.user.id);

        res.json({
            success: true,
            message: `Unsubscribed ${count} device(s)`
        });
    } catch (error) {
        console.error('[Push Routes] Unsubscribe all error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unsubscribe devices',
            message: error.message
        });
    }
});

// @route   GET /api/push/subscriptions
// @desc    Get user's push subscriptions
// @access  Private
router.get('/subscriptions', pushLimiter, auth, async (req, res) => {
    try {
        const subscriptions = await PushNotificationService.getSubscriptions(req.user.id);

        res.json({
            success: true,
            count: subscriptions.length,
            subscriptions
        });
    } catch (error) {
        console.error('[Push Routes] Get subscriptions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get subscriptions',
            message: error.message
        });
    }
});

// @route   PUT /api/push/preferences
// @desc    Update push notification preferences
// @access  Private
router.put('/preferences', pushLimiter, auth, async (req, res) => {
    try {
        const { preferences } = req.body;

        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid preferences object'
            });
        }

        // Validate preference keys
        const validPreferences = ['predictions', 'priceAlerts', 'copyTrading', 'social', 'achievements', 'system', 'marketing'];
        const cleanPreferences = {};

        for (const key of validPreferences) {
            if (key in preferences) {
                cleanPreferences[key] = Boolean(preferences[key]);
            }
        }

        await PushNotificationService.updatePreferences(req.user.id, cleanPreferences);

        res.json({
            success: true,
            message: 'Preferences updated',
            preferences: cleanPreferences
        });
    } catch (error) {
        console.error('[Push Routes] Update preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences',
            message: error.message
        });
    }
});

// @route   PUT /api/push/subscriptions/:id/preferences
// @desc    Update preferences for a specific subscription
// @access  Private
router.put('/subscriptions/:id/preferences', pushLimiter, auth, async (req, res) => {
    try {
        const { preferences } = req.body;

        const subscription = await PushSubscription.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        // Merge with existing preferences
        subscription.preferences = {
            ...subscription.preferences,
            ...preferences
        };
        await subscription.save();

        res.json({
            success: true,
            message: 'Subscription preferences updated',
            preferences: subscription.preferences
        });
    } catch (error) {
        console.error('[Push Routes] Update subscription preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences',
            message: error.message
        });
    }
});

// @route   DELETE /api/push/subscriptions/:id
// @desc    Delete a specific subscription
// @access  Private
router.delete('/subscriptions/:id', pushLimiter, auth, async (req, res) => {
    try {
        const result = await PushSubscription.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            message: 'Subscription deleted'
        });
    } catch (error) {
        console.error('[Push Routes] Delete subscription error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete subscription',
            message: error.message
        });
    }
});

// @route   POST /api/push/test
// @desc    Send a test push notification
// @access  Private
router.post('/test', pushLimiter, auth, async (req, res) => {
    try {
        if (!PushNotificationService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'Push notifications not configured'
            });
        }

        const hasSubscription = await PushSubscription.hasActiveSubscription(req.user.id);
        if (!hasSubscription) {
            return res.status(400).json({
                success: false,
                error: 'No active push subscription found'
            });
        }

        const result = await PushNotificationService.sendToUser(req.user.id, {
            type: 'system',
            title: '🔔 Test Notification',
            message: 'Push notifications are working! You\'ll receive alerts for predictions, price changes, and more.',
            link: '/settings',
            data: { test: true }
        });

        res.json({
            success: true,
            message: 'Test notification sent',
            result
        });
    } catch (error) {
        console.error('[Push Routes] Test error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test notification',
            message: error.message
        });
    }
});

module.exports = router;
