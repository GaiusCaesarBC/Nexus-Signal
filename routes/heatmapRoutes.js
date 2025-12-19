// server/routes/heatmapRoutes.js - Market Heatmap Routes

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const heatmapService = require('../services/heatmapService');

// Rate limiter for heatmap endpoints (heavier operations)
const heatmapLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false
});

// @route   GET /api/heatmap/stocks
// @desc    Get stock market heatmap data
// @access  Private
router.get('/stocks', heatmapLimiter, auth, async (req, res) => {
    try {
        const data = await heatmapService.getStockHeatmap();
        res.json(data);
    } catch (error) {
        console.error('[Heatmap] Error getting stock heatmap:', error.message);
        res.status(500).json({ error: 'Failed to load stock heatmap' });
    }
});

// @route   GET /api/heatmap/crypto
// @desc    Get crypto market heatmap data (CoinGecko + GeckoTerminal DEX)
// @access  Private
router.get('/crypto', heatmapLimiter, auth, async (req, res) => {
    try {
        const data = await heatmapService.getCryptoHeatmap();
        res.json(data);
    } catch (error) {
        console.error('[Heatmap] Error getting crypto heatmap:', error.message);
        res.status(500).json({ error: 'Failed to load crypto heatmap' });
    }
});

// @route   GET /api/heatmap/dex
// @desc    Get DEX-only heatmap data (GeckoTerminal BSC/ETH/SOL tokens)
// @access  Private
router.get('/dex', heatmapLimiter, auth, async (req, res) => {
    try {
        const { network = 'bsc' } = req.query;
        const data = await heatmapService.getDexHeatmap(network);
        res.json(data);
    } catch (error) {
        console.error('[Heatmap] Error getting DEX heatmap:', error.message);
        res.status(500).json({ error: 'Failed to load DEX heatmap' });
    }
});

module.exports = router;