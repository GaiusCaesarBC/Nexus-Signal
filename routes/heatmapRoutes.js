// server/routes/heatmapRoutes.js - Market Heatmap Routes

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const heatmapService = require('../services/heatmapService');
const marketPulse = require('../services/marketPulse');

// In-memory cache for pulse snapshots (60s TTL)
const pulseCache = new Map();
const PULSE_TTL_MS = 60 * 1000;
function pulseGet(key) {
    const hit = pulseCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > PULSE_TTL_MS) { pulseCache.delete(key); return null; }
    return hit.v;
}
function pulseSet(key, value) {
    if (pulseCache.size > 20) {
        const first = pulseCache.keys().next().value;
        pulseCache.delete(first);
    }
    pulseCache.set(key, { t: Date.now(), v: value });
}

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

// ─────────────────────────────────────────────────────────
// MARKET PULSE — full snapshot endpoint
// ─────────────────────────────────────────────────────────

// @route   GET /api/heatmap/pulse
// @desc    Full Market Pulse snapshot (sentiment + insight + movers + treemap)
// @access  Private
router.get('/pulse', heatmapLimiter, auth, async (req, res) => {
    try {
        const assetType = req.query.asset === 'crypto' ? 'crypto' : 'stocks';
        const timeframe = req.query.timeframe || '24h';
        const filters = {
            minAbsMove: req.query.minMove ? Number(req.query.minMove) : null,
            minVolumeSpike: req.query.minVol ? Number(req.query.minVol) : null,
            sectors: req.query.sectors ? String(req.query.sectors).split(',').filter(Boolean) : []
        };

        const cacheKey = `pulse:${assetType}:${timeframe}:${JSON.stringify(filters)}`;
        let snapshot = pulseGet(cacheKey);
        if (!snapshot) {
            snapshot = await marketPulse.getPulseSnapshot({ assetType, timeframe, filters });
            pulseSet(cacheKey, snapshot);
        }
        res.json(snapshot);
    } catch (error) {
        console.error('[MarketPulse] Snapshot error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to load market pulse' });
    }
});

module.exports = router;