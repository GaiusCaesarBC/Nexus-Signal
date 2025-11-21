// server/routes/screenerRoutes.js - Real-time Screener Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const screenerService = require('../services/screenerService');

// @route   GET /api/screener/stocks
// @desc    Screen stocks with filters
// @access  Private
router.get('/stocks', auth, async (req, res) => {
    try {
        const filters = {
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
            minVolume: req.query.minVolume ? parseFloat(req.query.minVolume) * 1000000 : null,
            changeFilter: req.query.changeFilter || 'all',
            sortBy: req.query.sortBy || 'volume'
        };

        const results = await screenerService.screenStocks(filters);
        res.json(results);

    } catch (error) {
        console.error('[Screener] Error screening stocks:', error.message);
        res.status(500).json({ error: 'Failed to screen stocks' });
    }
});

// @route   GET /api/screener/crypto
// @desc    Screen crypto with filters
// @access  Private
router.get('/crypto', auth, async (req, res) => {
    try {
        const filters = {
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
            minVolume: req.query.minVolume ? parseFloat(req.query.minVolume) * 1000000 : null,
            minMarketCap: req.query.minMarketCap ? parseFloat(req.query.minMarketCap) : null,
            maxMarketCap: req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap) : null,
            changeFilter: req.query.changeFilter || 'all',
            sortBy: req.query.sortBy || 'market_cap_desc'
        };

        const results = await screenerService.screenCrypto(filters);
        res.json(results);

    } catch (error) {
        console.error('[Screener] Error screening crypto:', error.message);
        res.status(500).json({ error: 'Failed to screen crypto' });
    }
});

module.exports = router;