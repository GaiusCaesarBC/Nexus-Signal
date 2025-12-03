const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireFeature, checkUsageLimit } = require('../middleware/subscriptionMiddleware');

// Alert model (you might need to create this)
// const Alert = require('../models/Alert');

// GET all alerts for user
router.get('/', auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        // Your alert fetching logic
        const alerts = [
            {
                id: '1',
                symbol: 'AAPL',
                type: 'price',
                condition: 'above',
                targetPrice: 155,
                currentPrice: 150.25,
                active: true,
                createdAt: new Date()
            },
            {
                id: '2',
                symbol: 'TSLA',
                type: 'price',
                condition: 'below',
                targetPrice: 200,
                currentPrice: 215.50,
                active: true,
                createdAt: new Date()
            }
        ];

        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create price alert - GATED PRO+
router.post('/price', 
    auth, 
    requireFeature('hasPriceAlerts'), // Pro or higher
    checkUsageLimit('priceAlerts'),
    async (req, res) => {
        try {
            const { symbol, condition, targetPrice, notifyEmail, notifySMS } = req.body;

            // Validate input
            if (!symbol || !condition || !targetPrice) {
                return res.status(400).json({ 
                    error: 'Symbol, condition, and target price are required' 
                });
            }

            if (!['above', 'below'].includes(condition)) {
                return res.status(400).json({ 
                    error: 'Condition must be "above" or "below"' 
                });
            }

            // SMS notifications require Premium+
            if (notifySMS && !req.planLimits.hasCustomAlerts) {
                return res.status(403).json({
                    error: 'SMS notifications require Premium or Elite plan',
                    requiresUpgrade: true,
                    requiredPlan: 'premium',
                    currentPlan: req.userPlan,
                    feature: 'SMS Notifications'
                });
            }

            // Create alert
            const alert = {
                id: Date.now().toString(),
                user: req.user.id,
                symbol: symbol.toUpperCase(),
                type: 'price',
                condition,
                targetPrice: parseFloat(targetPrice),
                notifyEmail: notifyEmail !== false, // Default true
                notifySMS: notifySMS || false,
                active: true,
                createdAt: new Date()
            };

            res.json({
                success: true,
                alert,
                remainingAlerts: req.remainingUsage
            });
        } catch (error) {
            console.error('Error creating price alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// POST create custom alert - GATED PREMIUM+
router.post('/custom', 
    auth, 
    requireFeature('hasCustomAlerts'), // Premium or Elite only
    async (req, res) => {
        try {
            const { 
                symbol, 
                alertType, // volume, volatility, technical, sentiment
                condition,
                threshold,
                notifyEmail,
                notifySMS,
                notifyPush
            } = req.body;

            // Validate input
            if (!symbol || !alertType || !condition) {
                return res.status(400).json({ 
                    error: 'Symbol, alert type, and condition are required' 
                });
            }

            const validTypes = ['volume', 'volatility', 'technical', 'sentiment', 'news'];
            if (!validTypes.includes(alertType)) {
                return res.status(400).json({ 
                    error: `Alert type must be one of: ${validTypes.join(', ')}` 
                });
            }

            // Create custom alert
            const alert = {
                id: Date.now().toString(),
                user: req.user.id,
                symbol: symbol.toUpperCase(),
                type: alertType,
                condition,
                threshold,
                notifyEmail: notifyEmail !== false,
                notifySMS: notifySMS || false,
                notifyPush: notifyPush !== false,
                active: true,
                createdAt: new Date()
            };

            res.json({
                success: true,
                alert
            });
        } catch (error) {
            console.error('Error creating custom alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// POST create pattern alert - GATED PREMIUM+
router.post('/pattern', 
    auth, 
    requireFeature('hasPatternRecognition'), // Premium or Elite
    async (req, res) => {
        try {
            const { 
                symbol, 
                patternType, // head-shoulders, triangle, breakout, support-resistance
                timeframe,
                notifyEmail,
                notifySMS
            } = req.body;

            // Validate input
            if (!symbol || !patternType) {
                return res.status(400).json({ 
                    error: 'Symbol and pattern type are required' 
                });
            }

            const validPatterns = [
                'head-shoulders', 
                'triangle', 
                'breakout', 
                'support-resistance',
                'double-top',
                'double-bottom',
                'flag',
                'pennant'
            ];

            if (!validPatterns.includes(patternType)) {
                return res.status(400).json({ 
                    error: `Pattern type must be one of: ${validPatterns.join(', ')}` 
                });
            }

            // Create pattern alert
            const alert = {
                id: Date.now().toString(),
                user: req.user.id,
                symbol: symbol.toUpperCase(),
                type: 'pattern',
                patternType,
                timeframe: timeframe || '1h',
                notifyEmail: notifyEmail !== false,
                notifySMS: notifySMS || false,
                active: true,
                createdAt: new Date()
            };

            res.json({
                success: true,
                alert
            });
        } catch (error) {
            console.error('Error creating pattern alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// PUT update alert
router.put('/:id', auth, async (req, res) => {
    try {
        const { active, targetPrice, threshold } = req.body;

        // Your update logic here
        const updatedAlert = {
            id: req.params.id,
            active,
            targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
            threshold,
            updatedAt: new Date()
        };

        res.json({
            success: true,
            alert: updatedAlert
        });
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE alert
router.delete('/:id', auth, async (req, res) => {
    try {
        // Your delete logic here
        res.json({
            success: true,
            message: 'Alert deleted'
        });
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET triggered alerts history
router.get('/history', auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        // Your alert history logic
        const history = [
            {
                id: '1',
                symbol: 'AAPL',
                type: 'price',
                condition: 'above',
                targetPrice: 150,
                triggeredPrice: 150.25,
                triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                notified: true
            },
            {
                id: '2',
                symbol: 'TSLA',
                type: 'volume',
                condition: 'spike',
                triggeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                notified: true
            }
        ];

        res.json(history.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Error fetching alert history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET alert statistics
router.get('/stats', auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        const plan = user.subscriptionPlan || 'free';
        const { PLAN_LIMITS } = require('../middleware/subscriptionMiddleware');
        const limits = PLAN_LIMITS[plan];

        const stats = {
            activeAlerts: 5,
            maxAlerts: limits.priceAlerts,
            triggeredToday: 3,
            triggeredThisWeek: 12,
            triggeredThisMonth: 45,
            accuracyRate: 87.5
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching alert stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST test alert (check if conditions are met now)
router.post('/:id/test', auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        // Your test logic - check current price/conditions
        const testResult = {
            alertId: req.params.id,
            wouldTrigger: false,
            currentValue: 150.25,
            targetValue: 155,
            difference: -4.75,
            message: 'Alert would trigger when price reaches $155 (currently $150.25)'
        };

        res.json(testResult);
    } catch (error) {
        console.error('Error testing alert:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;