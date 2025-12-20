const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { requireFeature, checkUsageLimit } = require('../middleware/subscriptionMiddleware');
const Alert = require('../models/Alert');

// Rate limiter for alerts endpoints (30 requests per minute)
const alertsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please slow down' }
});

// GET all alerts for user
router.get('/', alertsLimiter, auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const { status = 'active' } = req.query;

        const query = { user: req.user.id };
        if (status && status !== 'all') {
            query.status = status;
        }

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            success: true,
            count: alerts.length,
            alerts
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create price alert - GATED PRO+
router.post('/price',
    alertsLimiter,
    auth,
    requireFeature('hasPriceAlerts'),
    checkUsageLimit('priceAlerts'),
    async (req, res) => {
        try {
            const { symbol, condition, targetPrice, assetType, notifyEmail, notifySMS } = req.body;

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

            // Map condition to type
            const type = condition === 'above' ? 'price_above' : 'price_below';

            // Create alert in database
            const alert = new Alert({
                user: req.user.id,
                type,
                symbol: symbol.toUpperCase(),
                assetType: assetType || 'stock',
                targetPrice: parseFloat(targetPrice),
                notifyVia: {
                    inApp: true,
                    email: notifyEmail !== false,
                    push: notifySMS || false
                },
                status: 'active'
            });

            await alert.save();

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

// POST create technical alert - GATED PREMIUM+
router.post('/technical',
    alertsLimiter,
    auth,
    requireFeature('hasCustomAlerts'),
    async (req, res) => {
        try {
            const {
                symbol,
                alertType,
                assetType,
                threshold,
                notifyEmail,
                notifyPush
            } = req.body;

            // Validate input
            if (!symbol || !alertType) {
                return res.status(400).json({
                    error: 'Symbol and alert type are required'
                });
            }

            const validTypes = [
                'rsi_oversold', 'rsi_overbought',
                'macd_bullish_crossover', 'macd_bearish_crossover',
                'bollinger_upper_breakout', 'bollinger_lower_breakout',
                'support_test', 'resistance_test'
            ];

            if (!validTypes.includes(alertType)) {
                return res.status(400).json({
                    error: `Alert type must be one of: ${validTypes.join(', ')}`
                });
            }

            // Create technical alert
            const alert = new Alert({
                user: req.user.id,
                type: alertType,
                symbol: symbol.toUpperCase(),
                assetType: assetType || 'stock',
                technicalParams: {
                    rsiThreshold: threshold,
                    supportLevel: alertType === 'support_test' ? threshold : undefined,
                    resistanceLevel: alertType === 'resistance_test' ? threshold : undefined
                },
                notifyVia: {
                    inApp: true,
                    email: notifyEmail !== false,
                    push: notifyPush || false
                },
                status: 'active'
            });

            await alert.save();

            res.json({
                success: true,
                alert
            });
        } catch (error) {
            console.error('Error creating technical alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// POST create pattern recognition alert - GATED PREMIUM+
router.post('/pattern',
    alertsLimiter,
    auth,
    requireFeature('hasCustomAlerts'),
    async (req, res) => {
        try {
            const {
                symbol,
                patternType,
                assetType,
                timeframe,
                minConfidence,
                notifyEmail,
                notifyPush
            } = req.body;

            // Validate input
            if (!symbol || !patternType) {
                return res.status(400).json({
                    error: 'Symbol and pattern type are required'
                });
            }

            const validPatterns = [
                'head_shoulders', 'inverse_head_shoulders',
                'double_top', 'double_bottom',
                'ascending_triangle', 'descending_triangle', 'symmetrical_triangle',
                'bull_flag', 'bear_flag',
                'rising_wedge', 'falling_wedge'
            ];

            if (!validPatterns.includes(patternType)) {
                return res.status(400).json({
                    error: `Pattern type must be one of: ${validPatterns.join(', ')}`
                });
            }

            const validTimeframes = ['1d', '4h', '1h'];
            const alertTimeframe = validTimeframes.includes(timeframe) ? timeframe : '1d';

            // Create pattern alert
            const alert = new Alert({
                user: req.user.id,
                type: patternType,
                symbol: symbol.toUpperCase(),
                assetType: assetType || 'stock',
                patternParams: {
                    timeframe: alertTimeframe,
                    minConfidence: minConfidence || 70,
                    lookbackPeriod: alertTimeframe === '1d' ? 50 : (alertTimeframe === '4h' ? 100 : 200)
                },
                notifyVia: {
                    inApp: true,
                    email: notifyEmail !== false,
                    push: notifyPush || false
                },
                status: 'active'
            });

            await alert.save();

            res.json({
                success: true,
                alert,
                message: `Pattern alert created for ${patternType} on ${symbol}`
            });
        } catch (error) {
            console.error('Error creating pattern alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET available pattern types
router.get('/pattern-types', alertsLimiter, auth, async (req, res) => {
    const patternTypes = [
        { type: 'head_shoulders', name: 'Head & Shoulders', direction: 'bearish', description: 'Classic reversal pattern with three peaks' },
        { type: 'inverse_head_shoulders', name: 'Inverse Head & Shoulders', direction: 'bullish', description: 'Bullish reversal with three troughs' },
        { type: 'double_top', name: 'Double Top', direction: 'bearish', description: 'Two peaks at similar levels' },
        { type: 'double_bottom', name: 'Double Bottom', direction: 'bullish', description: 'Two troughs at similar levels' },
        { type: 'ascending_triangle', name: 'Ascending Triangle', direction: 'bullish', description: 'Flat resistance with rising support' },
        { type: 'descending_triangle', name: 'Descending Triangle', direction: 'bearish', description: 'Flat support with falling resistance' },
        { type: 'symmetrical_triangle', name: 'Symmetrical Triangle', direction: 'neutral', description: 'Converging trend lines, breakout imminent' },
        { type: 'bull_flag', name: 'Bull Flag', direction: 'bullish', description: 'Strong move up followed by consolidation' },
        { type: 'bear_flag', name: 'Bear Flag', direction: 'bearish', description: 'Strong move down followed by consolidation' },
        { type: 'rising_wedge', name: 'Rising Wedge', direction: 'bearish', description: 'Converging upward lines, bearish reversal' },
        { type: 'falling_wedge', name: 'Falling Wedge', direction: 'bullish', description: 'Converging downward lines, bullish reversal' }
    ];

    res.json({
        success: true,
        patterns: patternTypes,
        timeframes: ['1d', '4h', '1h']
    });
});

// POST create percent change alert - GATED PRO+
router.post('/percent-change',
    alertsLimiter,
    auth,
    requireFeature('hasPriceAlerts'),
    checkUsageLimit('priceAlerts'),
    async (req, res) => {
        try {
            const { symbol, percentChange, timeframe, assetType, notifyEmail } = req.body;

            // Validate input
            if (!symbol || percentChange === undefined) {
                return res.status(400).json({
                    error: 'Symbol and percent change are required'
                });
            }

            const validTimeframes = ['1h', '24h', '7d', '30d'];
            if (timeframe && !validTimeframes.includes(timeframe)) {
                return res.status(400).json({
                    error: `Timeframe must be one of: ${validTimeframes.join(', ')}`
                });
            }

            const alert = new Alert({
                user: req.user.id,
                type: 'percent_change',
                symbol: symbol.toUpperCase(),
                assetType: assetType || 'stock',
                percentChange: parseFloat(percentChange),
                timeframe: timeframe || '24h',
                notifyVia: {
                    inApp: true,
                    email: notifyEmail !== false,
                    push: false
                },
                status: 'active'
            });

            await alert.save();

            res.json({
                success: true,
                alert,
                remainingAlerts: req.remainingUsage
            });
        } catch (error) {
            console.error('Error creating percent change alert:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// PUT update alert
router.put('/:id', alertsLimiter, auth, async (req, res) => {
    try {
        const { status, targetPrice, threshold, notifyVia } = req.body;

        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Update fields
        if (status && ['active', 'cancelled'].includes(status)) {
            alert.status = status;
        }
        if (targetPrice !== undefined) {
            alert.targetPrice = parseFloat(targetPrice);
        }
        if (threshold !== undefined) {
            alert.technicalParams.rsiThreshold = threshold;
        }
        if (notifyVia) {
            alert.notifyVia = { ...alert.notifyVia, ...notifyVia };
        }

        await alert.save();

        res.json({
            success: true,
            alert
        });
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE alert
router.delete('/:id', alertsLimiter, auth, async (req, res) => {
    try {
        const alert = await Alert.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

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
router.get('/history', alertsLimiter, auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const history = await Alert.getTriggeredAlerts(req.user.id, parseInt(limit));

        res.json({
            success: true,
            count: history.length,
            history
        });
    } catch (error) {
        console.error('Error fetching alert history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET alert statistics
router.get('/stats', alertsLimiter, auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        const plan = user.subscriptionPlan || 'free';
        const { PLAN_LIMITS } = require('../middleware/subscriptionMiddleware');
        const limits = PLAN_LIMITS[plan];

        // Get actual counts from database
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [activeCount, todayCount, weekCount, monthCount] = await Promise.all([
            Alert.countDocuments({ user: req.user.id, status: 'active' }),
            Alert.countDocuments({
                user: req.user.id,
                status: 'triggered',
                triggeredAt: { $gte: todayStart }
            }),
            Alert.countDocuments({
                user: req.user.id,
                status: 'triggered',
                triggeredAt: { $gte: weekStart }
            }),
            Alert.countDocuments({
                user: req.user.id,
                status: 'triggered',
                triggeredAt: { $gte: monthStart }
            })
        ]);

        const stats = {
            activeAlerts: activeCount,
            maxAlerts: limits.priceAlerts,
            triggeredToday: todayCount,
            triggeredThisWeek: weekCount,
            triggeredThisMonth: monthCount
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching alert stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST test alert (check if conditions would be met)
router.post('/:id/test', alertsLimiter, auth, requireFeature('hasPriceAlerts'), async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Would need to fetch current price from price service
        // For now, return alert info
        const testResult = {
            alertId: alert._id,
            type: alert.type,
            symbol: alert.symbol,
            targetPrice: alert.targetPrice,
            status: alert.status,
            lastChecked: alert.lastChecked,
            message: `Alert is ${alert.status}. Target: $${alert.targetPrice || 'N/A'}`
        };

        res.json(testResult);
    } catch (error) {
        console.error('Error testing alert:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST cancel all active alerts
router.post('/cancel-all', alertsLimiter, auth, async (req, res) => {
    try {
        const result = await Alert.updateMany(
            { user: req.user.id, status: 'active' },
            { $set: { status: 'cancelled' } }
        );

        res.json({
            success: true,
            cancelled: result.modifiedCount
        });
    } catch (error) {
        console.error('Error cancelling alerts:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
