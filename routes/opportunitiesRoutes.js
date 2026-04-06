// server/routes/opportunitiesRoutes.js
// Opportunity Engine API — powers the /opportunities page on the frontend.

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const opportunityEngine = require('../services/opportunityEngine');

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many opportunity requests, please slow down' }
});

// Simple in-memory cache (60s TTL) — opportunity scans are expensive
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > CACHE_TTL_MS) { cache.delete(key); return null; }
    return hit.v;
}
function cacheSet(key, value) {
    if (cache.size > 50) {
        // Drop oldest
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, { t: Date.now(), v: value });
}

function parseFilters(req) {
    const {
        asset, bias, confMin, setup, minRR, minScore, sortBy, sortDir, preset
    } = req.query;

    const filters = {
        assetType: asset || 'all',
        bias: bias || 'all',
        confidenceMin: confMin ? Number(confMin) : null,
        setupTypes: setup ? String(setup).split(',').map(s => s.trim()).filter(Boolean) : [],
        minRR: minRR ? Number(minRR) : null,
        minAiScore: minScore ? Number(minScore) : null,
        sortBy: sortBy || 'ai_score',
        sortDir: sortDir || 'desc'
    };

    // Preset overrides
    if (preset) {
        switch (preset) {
            case 'breakouts':
                filters.setupTypes = ['breakout'];
                break;
            case 'reversals':
                filters.setupTypes = ['reversal'];
                break;
            case 'unusual_volume':
                filters.setupTypes = ['unusual_volume'];
                break;
            case 'oversold_bounce':
                filters.setupTypes = ['oversold_bounce'];
                break;
            case 'momentum':
                filters.setupTypes = ['momentum'];
                break;
            case 'high_conviction':
                filters.minAiScore = 80;
                break;
            case 'long':
                filters.bias = 'long';
                break;
            case 'short':
                filters.bias = 'short';
                break;
        }
    }
    return filters;
}

// @route   GET /api/opportunities
// @desc    Get ranked opportunities with filters
// @access  Public (free tier sees limited results — handled client-side)
router.get('/', limiter, async (req, res) => {
    try {
        const filters = parseFilters(req);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const offset = Math.max(0, Number(req.query.offset) || 0);

        const cacheKey = `opps:${JSON.stringify(filters)}`;
        let results = cacheGet(cacheKey);
        if (!results) {
            results = await opportunityEngine.getOpportunities(filters);
            cacheSet(cacheKey, results);
        }

        const sliced = results.slice(offset, offset + limit);
        res.json({
            success: true,
            count: results.length,
            returned: sliced.length,
            offset,
            limit,
            opportunities: sliced
        });
    } catch (err) {
        console.error('[Opportunities] Error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch opportunities' });
    }
});

// @route   GET /api/opportunities/featured
// @desc    Top 5 featured opportunities for hero cards
// @access  Public
router.get('/featured', limiter, async (req, res) => {
    try {
        const limit = Math.min(10, Number(req.query.limit) || 5);
        const cacheKey = `featured:${limit}`;
        let featured = cacheGet(cacheKey);
        if (!featured) {
            featured = await opportunityEngine.getFeaturedOpportunities(limit);
            cacheSet(cacheKey, featured);
        }
        res.json({ success: true, count: featured.length, opportunities: featured });
    } catch (err) {
        console.error('[Opportunities] Featured error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch featured opportunities' });
    }
});

// @route   GET /api/opportunities/presets
// @desc    Preset definitions + live counts (for tab badges)
// @access  Public
router.get('/presets', limiter, async (req, res) => {
    try {
        const cacheKey = 'presets';
        let counts = cacheGet(cacheKey);
        if (!counts) {
            counts = await opportunityEngine.getPresetCounts();
            cacheSet(cacheKey, counts);
        }

        const presets = [
            { id: 'all', label: 'All Opportunities', count: counts.all },
            { id: 'high_conviction', label: 'High Conviction', count: counts.high_conviction },
            { id: 'breakouts', label: 'Breakouts', count: counts.breakouts },
            { id: 'reversals', label: 'Reversals', count: counts.reversals },
            { id: 'unusual_volume', label: 'Unusual Volume', count: counts.unusual_volume },
            { id: 'oversold_bounce', label: 'Oversold Bounce', count: counts.oversold_bounce },
            { id: 'momentum', label: 'Momentum', count: counts.momentum },
            { id: 'long', label: 'Long Only', count: counts.long },
            { id: 'short', label: 'Short Only', count: counts.short }
        ];

        res.json({ success: true, presets, counts });
    } catch (err) {
        console.error('[Opportunities] Presets error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch presets' });
    }
});

// @route   GET /api/opportunities/status
// @desc    Engine status meta — last scan, total found, market bias
// @access  Public
router.get('/status', limiter, async (req, res) => {
    try {
        const cacheKey = 'status';
        let status = cacheGet(cacheKey);
        if (!status) {
            status = await opportunityEngine.getEngineStatus();
            cacheSet(cacheKey, status);
        }
        res.json({ success: true, ...status });
    } catch (err) {
        console.error('[Opportunities] Status error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch engine status' });
    }
});

module.exports = router;
