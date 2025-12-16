// server/routes/alertRoutes.js - Alert Management API

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Alert = require('../models/Alert');
const GamificationService = require('../services/gamificationService');

// Technical alert types
const TECHNICAL_ALERT_TYPES = [
    'rsi_oversold', 'rsi_overbought',
    'macd_bullish_crossover', 'macd_bearish_crossover',
    'bollinger_upper_breakout', 'bollinger_lower_breakout',
    'support_test', 'resistance_test'
];

// @route   GET /api/alerts/technical-types
// @desc    Get available technical alert types
// @access  Public
router.get('/technical-types', (req, res) => {
    res.json({
        success: true,
        types: [
            { value: 'rsi_oversold', label: 'RSI Oversold', description: 'Alert when RSI drops below threshold (default 30)', params: ['rsiThreshold'] },
            { value: 'rsi_overbought', label: 'RSI Overbought', description: 'Alert when RSI rises above threshold (default 70)', params: ['rsiThreshold'] },
            { value: 'macd_bullish_crossover', label: 'MACD Bullish Crossover', description: 'Alert when MACD line crosses above signal line', params: [] },
            { value: 'macd_bearish_crossover', label: 'MACD Bearish Crossover', description: 'Alert when MACD line crosses below signal line', params: [] },
            { value: 'bollinger_upper_breakout', label: 'Bollinger Upper Breakout', description: 'Alert when price breaks above upper Bollinger Band', params: [] },
            { value: 'bollinger_lower_breakout', label: 'Bollinger Lower Breakout', description: 'Alert when price breaks below lower Bollinger Band', params: [] },
            { value: 'support_test', label: 'Support Level Test', description: 'Alert when price approaches support level', params: ['supportLevel', 'tolerance'] },
            { value: 'resistance_test', label: 'Resistance Level Test', description: 'Alert when price approaches resistance level', params: ['resistanceLevel', 'tolerance'] }
        ]
    });
});

// @route   POST /api/alerts
// @desc    Create a new alert
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const {
            type,
            symbol,
            assetType,
            targetPrice,
            percentChange,
            timeframe,
            portfolioThreshold,
            prediction,
            notifyVia,
            customMessage,
            recurring,
            expiresAt,
            technicalParams  // NEW: For technical alerts
        } = req.body;

        // Validation
        if (!type) {
            return res.status(400).json({ error: 'Alert type is required' });
        }

        // Validate required fields based on type
        if (['price_above', 'price_below'].includes(type)) {
            if (!symbol || !targetPrice) {
                return res.status(400).json({
                    error: 'Symbol and target price are required for price alerts'
                });
            }
        }

        if (type === 'percent_change') {
            if (!symbol || !percentChange) {
                return res.status(400).json({
                    error: 'Symbol and percent change are required'
                });
            }
        }

        // Validate technical alert types
        if (TECHNICAL_ALERT_TYPES.includes(type)) {
            if (!symbol) {
                return res.status(400).json({
                    error: 'Symbol is required for technical alerts'
                });
            }

            // Validate specific technical params
            if (type === 'support_test' && (!technicalParams?.supportLevel)) {
                return res.status(400).json({
                    error: 'Support level is required for support test alerts'
                });
            }

            if (type === 'resistance_test' && (!technicalParams?.resistanceLevel)) {
                return res.status(400).json({
                    error: 'Resistance level is required for resistance test alerts'
                });
            }
        }

        // Build alert object
        const alertData = {
            user: req.user.id,
            type,
            symbol: symbol?.toUpperCase(),
            assetType,
            targetPrice,
            percentChange,
            timeframe,
            portfolioThreshold,
            prediction,
            notifyVia: notifyVia || { inApp: true, email: false, push: false },
            customMessage,
            recurring,
            expiresAt: expiresAt || undefined
        };

        // Add technical params if this is a technical alert
        if (TECHNICAL_ALERT_TYPES.includes(type) && technicalParams) {
            alertData.technicalParams = {
                rsiThreshold: technicalParams.rsiThreshold,
                supportLevel: technicalParams.supportLevel,
                resistanceLevel: technicalParams.resistanceLevel,
                tolerance: technicalParams.tolerance || 2
            };
        }

        // Create alert
        const alert = new Alert(alertData);

        await alert.save();

        console.log(`[Alerts] Created ${type} alert for user ${req.user.id}${symbol ? ` on ${symbol}` : ''}`);

        // 🎮 Award XP for creating alert
        try {
            await GamificationService.awardXP(req.user.id, 5, 'Alert created');
        } catch (error) {
            console.warn('Failed to award XP:', error.message);
        }

        res.status(201).json({
            success: true,
            alert
        });

    } catch (error) {
        console.error('[Alerts] Create error:', error);
        res.status(500).json({
            error: 'Failed to create alert',
            message: error.message
        });
    }
});

// @route   GET /api/alerts
// @desc    Get user's alerts
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { status, type, symbol, limit = 50 } = req.query;

        const query = { user: req.user.id };

        if (status) query.status = status;
        if (type) query.type = type;
        if (symbol) query.symbol = symbol.toUpperCase();

        const alerts = await Alert.find(query)
            .populate('prediction', 'symbol targetPrice direction')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: alerts.length,
            alerts
        });

    } catch (error) {
        console.error('[Alerts] Fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch alerts',
            message: error.message 
        });
    }
});

// @route   GET /api/alerts/active
// @desc    Get user's active alerts
// @access  Private
router.get('/active', auth, async (req, res) => {
    try {
        const alerts = await Alert.getActiveAlerts(req.user.id);

        res.json({
            success: true,
            count: alerts.length,
            alerts
        });

    } catch (error) {
        console.error('[Alerts] Fetch active error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch active alerts',
            message: error.message 
        });
    }
});

// @route   GET /api/alerts/triggered
// @desc    Get user's triggered alerts (recent notifications)
// @access  Private
router.get('/triggered', auth, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const alerts = await Alert.getTriggeredAlerts(req.user.id, parseInt(limit));

        res.json({
            success: true,
            count: alerts.length,
            alerts
        });

    } catch (error) {
        console.error('[Alerts] Fetch triggered error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch triggered alerts',
            message: error.message 
        });
    }
});

// @route   GET /api/alerts/stats
// @desc    Get user's alert statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const [active, triggered, expired, cancelled] = await Promise.all([
            Alert.countDocuments({ user: req.user.id, status: 'active' }),
            Alert.countDocuments({ user: req.user.id, status: 'triggered' }),
            Alert.countDocuments({ user: req.user.id, status: 'expired' }),
            Alert.countDocuments({ user: req.user.id, status: 'cancelled' })
        ]);

        res.json({
            success: true,
            stats: {
                active,
                triggered,
                expired,
                cancelled,
                total: active + triggered + expired + cancelled
            }
        });

    } catch (error) {
        console.error('[Alerts] Stats error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch alert stats',
            message: error.message 
        });
    }
});

// @route   GET /api/alerts/:id
// @desc    Get single alert
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate('prediction');

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({
            success: true,
            alert
        });

    } catch (error) {
        console.error('[Alerts] Fetch single error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch alert',
            message: error.message 
        });
    }
});

// @route   PUT /api/alerts/:id
// @desc    Update alert
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const {
            targetPrice,
            percentChange,
            timeframe,
            notifyVia,
            customMessage,
            expiresAt,
            status
        } = req.body;

        // Update allowed fields
        if (targetPrice !== undefined) alert.targetPrice = targetPrice;
        if (percentChange !== undefined) alert.percentChange = percentChange;
        if (timeframe !== undefined) alert.timeframe = timeframe;
        if (notifyVia !== undefined) alert.notifyVia = notifyVia;
        if (customMessage !== undefined) alert.customMessage = customMessage;
        if (expiresAt !== undefined) alert.expiresAt = expiresAt;
        if (status !== undefined) alert.status = status;

        await alert.save();

        console.log(`[Alerts] Updated alert ${alert._id}`);

        res.json({
            success: true,
            alert
        });

    } catch (error) {
        console.error('[Alerts] Update error:', error);
        res.status(500).json({ 
            error: 'Failed to update alert',
            message: error.message 
        });
    }
});

// @route   DELETE /api/alerts/:id
// @desc    Delete/cancel alert
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Soft delete - mark as cancelled instead of removing
        alert.status = 'cancelled';
        await alert.save();

        console.log(`[Alerts] Cancelled alert ${alert._id}`);

        res.json({
            success: true,
            message: 'Alert cancelled'
        });

    } catch (error) {
        console.error('[Alerts] Delete error:', error);
        res.status(500).json({ 
            error: 'Failed to delete alert',
            message: error.message 
        });
    }
});

// @route   POST /api/alerts/batch-delete
// @desc    Delete multiple alerts
// @access  Private
router.post('/batch-delete', auth, async (req, res) => {
    try {
        const { alertIds } = req.body;

        if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
            return res.status(400).json({ error: 'Alert IDs array is required' });
        }

        const result = await Alert.updateMany(
            {
                _id: { $in: alertIds },
                user: req.user.id
            },
            {
                $set: { status: 'cancelled' }
            }
        );

        console.log(`[Alerts] Batch cancelled ${result.modifiedCount} alerts`);

        res.json({
            success: true,
            cancelled: result.modifiedCount
        });

    } catch (error) {
        console.error('[Alerts] Batch delete error:', error);
        res.status(500).json({ 
            error: 'Failed to delete alerts',
            message: error.message 
        });
    }
});

// @route   POST /api/alerts/mark-read
// @desc    Mark triggered alerts as read
// @access  Private
router.post('/mark-read', auth, async (req, res) => {
    try {
        const { alertIds } = req.body;

        const query = { user: req.user.id, status: 'triggered' };
        
        if (alertIds && alertIds.length > 0) {
            query._id = { $in: alertIds };
        }

        const result = await Alert.updateMany(
            query,
            {
                $set: { read: true }
            }
        );

        res.json({
            success: true,
            marked: result.modifiedCount
        });

    } catch (error) {
        console.error('[Alerts] Mark read error:', error);
        res.status(500).json({ 
            error: 'Failed to mark alerts as read',
            message: error.message 
        });
    }
});

// @route   POST /api/alerts/test/:id
// @desc    Test an alert (trigger it manually)
// @access  Private
router.post('/test/:id', auth, async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Manually trigger the alert
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        alert.triggeredPrice = alert.currentPrice || alert.targetPrice;
        await alert.save();

        console.log(`[Alerts] Manually triggered alert ${alert._id} for testing`);

        res.json({
            success: true,
            message: 'Alert triggered for testing',
            alert
        });

    } catch (error) {
        console.error('[Alerts] Test error:', error);
        res.status(500).json({ 
            error: 'Failed to test alert',
            message: error.message 
        });
    }
});

module.exports = router;