// server/routes/portfolioHistoryRoutes.js - Track Portfolio Performance Over Time

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// In-memory storage (you can move to MongoDB later)
const portfolioHistory = new Map();

// @route   POST /api/portfolio/history/snapshot
// @desc    Save current portfolio value snapshot
// @access  Private
router.post('/snapshot', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { totalValue, totalGainLoss, totalGainLossPercent } = req.body;
        
        if (!portfolioHistory.has(userId)) {
            portfolioHistory.set(userId, []);
        }
        
        const history = portfolioHistory.get(userId);
        
        // Add new snapshot
        history.push({
            date: new Date().toISOString(),
            totalValue: totalValue || 0,
            totalGainLoss: totalGainLoss || 0,
            totalGainLossPercent: totalGainLossPercent || 0,
            timestamp: Date.now()
        });
        
        // Keep only last 90 days
        const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
        const filtered = history.filter(h => h.timestamp > ninetyDaysAgo);
        portfolioHistory.set(userId, filtered);
        
        console.log(`[Portfolio History] Snapshot saved for user ${userId}`);
        
        res.json({
            success: true,
            message: 'Snapshot saved',
            historyLength: filtered.length
        });
        
    } catch (error) {
        console.error('Error saving snapshot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save snapshot'
        });
    }
});

// @route   GET /api/portfolio/history/:days
// @desc    Get portfolio history for last N days
// @access  Private
router.get('/history/:days', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const days = parseInt(req.params.days) || 7;
        
        if (!portfolioHistory.has(userId)) {
            return res.json({
                success: true,
                history: [],
                message: 'No history yet'
            });
        }
        
        const history = portfolioHistory.get(userId);
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const filtered = history.filter(h => h.timestamp > cutoffTime);
        
        res.json({
            success: true,
            history: filtered,
            count: filtered.length
        });
        
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history'
        });
    }
});

module.exports = router;