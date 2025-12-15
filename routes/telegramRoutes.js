// Telegram Integration Routes
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const telegramService = require('../services/telegramService');

// Generate link token for connecting Telegram
router.post('/generate-link', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a unique link token
        const linkToken = crypto.randomBytes(32).toString('hex');

        // Store token with expiration (24 hours)
        user.telegramLinkToken = linkToken;
        user.telegramLinkTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        // Generate the deep link URL
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'NexusSignalBot';
        const deepLink = `https://t.me/${botUsername}?start=${linkToken}`;

        res.json({
            success: true,
            linkToken,
            deepLink,
            expiresIn: '24 hours'
        });
    } catch (error) {
        console.error('Error generating Telegram link:', error);
        res.status(500).json({ error: 'Failed to generate link' });
    }
});

// Get Telegram connection status
router.get('/status', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(
            'telegramChatId telegramUsername telegramLinkedAt telegramNotifications'
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            connected: !!user.telegramChatId,
            username: user.telegramUsername,
            linkedAt: user.telegramLinkedAt,
            notifications: user.telegramNotifications || {
                economicEvents: true,
                whaleAlerts: true,
                dailySummary: true,
                mlPredictions: true,
                priceAlerts: true
            }
        });
    } catch (error) {
        console.error('Error getting Telegram status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Unlink Telegram account
router.post('/unlink', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.telegramChatId) {
            return res.status(400).json({ error: 'No Telegram account linked' });
        }

        // Send goodbye message before unlinking
        if (telegramService.isBotActive()) {
            await telegramService.sendToChatId(
                user.telegramChatId,
                `👋 *Account Unlinked*\n\nYour Nexus Signal account has been disconnected. You will no longer receive notifications.\n\nYou can link again anytime from the app settings.`
            );
        }

        // Clear Telegram data
        user.telegramChatId = null;
        user.telegramUsername = null;
        user.telegramLinkedAt = null;
        await user.save();

        res.json({
            success: true,
            message: 'Telegram account unlinked successfully'
        });
    } catch (error) {
        console.error('Error unlinking Telegram:', error);
        res.status(500).json({ error: 'Failed to unlink account' });
    }
});

// Update notification preferences
router.put('/notifications', auth, async (req, res) => {
    try {
        const { economicEvents, whaleAlerts, dailySummary, mlPredictions, priceAlerts } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update preferences
        user.telegramNotifications = {
            economicEvents: economicEvents !== undefined ? economicEvents : true,
            whaleAlerts: whaleAlerts !== undefined ? whaleAlerts : true,
            dailySummary: dailySummary !== undefined ? dailySummary : true,
            mlPredictions: mlPredictions !== undefined ? mlPredictions : true,
            priceAlerts: priceAlerts !== undefined ? priceAlerts : true
        };

        await user.save();

        res.json({
            success: true,
            notifications: user.telegramNotifications
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Send test notification
router.post('/test', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.telegramChatId) {
            return res.status(400).json({ error: 'No Telegram account linked' });
        }

        if (!telegramService.isBotActive()) {
            return res.status(503).json({ error: 'Telegram bot is not available' });
        }

        const success = await telegramService.sendToChatId(
            user.telegramChatId,
            `🎉 *Test Notification*\n\nCongratulations! Your Nexus Signal notifications are working perfectly!\n\n_This is a test message sent from your account settings._`
        );

        if (success) {
            res.json({ success: true, message: 'Test notification sent!' });
        } else {
            res.status(500).json({ error: 'Failed to send test notification' });
        }
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: 'Failed to send test notification' });
    }
});

// Get bot info (public)
router.get('/bot-info', (req, res) => {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'NexusSignalBot';
    res.json({
        botUsername,
        botLink: `https://t.me/${botUsername}`,
        isActive: telegramService.isBotActive()
    });
});

module.exports = router;
