// server/routes/heatmapRoutes.js - Market Heatmap Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const heatmapService = require('../services/heatmapService');

// @route   GET /api/heatmap/stocks
// @desc    Get stock market heatmap data
// @access  Private
router.get('/stocks', auth, async (req, res) => {
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
router.get('/crypto', auth, async (req, res) => {
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
router.get('/dex', auth, async (req, res) => {
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